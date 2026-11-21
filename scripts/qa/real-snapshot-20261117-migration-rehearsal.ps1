# LOCAL-ONLY: production snapshot is read from a DPAPI-encrypted QA backup. Never connects to Supabase cloud.
$ErrorActionPreference='Stop'
$qa=Join-Path $env:LOCALAPPDATA 'INKR-QA'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bin=Join-Path $qa 'tools\pgsql-17.12\bin'
$work=Join-Path $qa 'clone\g4-real-snapshot-rehearsal-20261121'
$pg=Join-Path $work 'cluster'
$dump=Join-Path $work 'production-readonly-snapshot-restore-input.dump'
$pwfile=Join-Path $work 'postgres-password.private'
$selection=Join-Path $work 'restore-selection.list'
$pgLog=Join-Path $work 'postgres-local.log'
$restoreLog=Join-Path $work 'restore.log'
$migrationLog=Join-Path $work 'migration-replay.log'
$reportPath=Join-Path $qa 'clone\g4-real-snapshot-transaction-20261121.json'
$port=55459;$started=$false;$source=$null
$report=[ordered]@{status='HOLD';host=$env:COMPUTERNAME;production_touched=$false;local_only=$true;db_endpoint='127.0.0.1:55459';snapshot='2026-11-17';migration_batch='202611*';transactional_rollback_tested=$false;started_at=(Get-Date).ToString('o')}
try {
 if(Test-Path $work){throw 'Existing disposable G4 work detected; refusing to overwrite'}
 if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw 'Dedicated loopback port already in use'}
 if(!(Test-Path (Join-Path $bin 'initdb.exe'))){throw 'Portable PostgreSQL 17 missing'}
 $source=Get-ChildItem (Join-Path $qa 'backups') -Filter '*.dump.dpapi' -File|Sort-Object LastWriteTime -Descending|Select-Object -First 1
 if(!$source){throw 'No DPAPI production snapshot present'}
 $metaFile=[IO.Path]::ChangeExtension($source.FullName,'.json')
 if(!(Test-Path $metaFile)){throw 'Backup metadata missing'}
 $meta=Get-Content $metaFile -Raw|ConvertFrom-Json
 if($meta.project_ref -ne 'jxmefklkixzzdceeorcg' -or (Get-FileHash $source.FullName -Algorithm SHA256).Hash -ne $meta.sha256_encrypted){throw 'Backup source or encrypted SHA mismatch'}
 New-Item -ItemType Directory -Path $work -Force|Out-Null
 Add-Type -AssemblyName System.Security
 $plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($source.FullName),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 try{[IO.File]::WriteAllBytes($dump,$plain)}finally{[Array]::Clear($plain,0,$plain.Length);$plain=$null}
 if((Get-FileHash $dump -Algorithm SHA256).Hash -ne $meta.sha256_plain){throw 'Decrypted SQL snapshot SHA mismatch'}
 $pw=([Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N'))
 [IO.File]::WriteAllText($pwfile,$pw,(New-Object Text.UTF8Encoding($false)))
 $env:PGPASSWORD=$pw;$pw=$null;$env:PGSSLMODE='disable';$env:PGCONNECT_TIMEOUT='5'
 & (Join-Path $bin 'initdb.exe') -D $pg -U inkr_g4_rehearsal -E UTF8 --locale=C --auth=scram-sha-256 --pwfile=$pwfile -N *>$null
 if($LASTEXITCODE -ne 0){throw 'Disposable PostgreSQL initdb failed'}
 Remove-Item $pwfile -Force
 & (Join-Path $bin 'pg_ctl.exe') -D $pg -l $pgLog -o "-h 127.0.0.1 -p $port" -w start
 if($LASTEXITCODE -ne 0){throw 'Disposable PostgreSQL start failed'}
 $started=$true
 & (Join-Path $bin 'createdb.exe') -w -h 127.0.0.1 -p $port -U inkr_g4_rehearsal inkr_real_snapshot_copy *>$null
 if($LASTEXITCODE -ne 0){throw 'Disposable PostgreSQL db creation failed'}
 $common=@('-X','-w','-h','127.0.0.1','-p',"$port",'-U','inkr_g4_rehearsal','-d','inkr_real_snapshot_copy','-v','ON_ERROR_STOP=1')
 $psql=Join-Path $bin 'psql.exe'
 & $psql @common -f (Join-Path $qa 'scripts\local-restore-extensions.sql') *>$null
 if($LASTEXITCODE -ne 0){throw 'Local Supabase extension shims failed'}
 $toc=@(& (Join-Path $bin 'pg_restore.exe') --list $dump)
 if($LASTEXITCODE -ne 0 -or $toc.Count -lt 40){throw 'Decrypted dump is not a valid PostgreSQL custom archive'}
 $publicEntries=@($toc|Where-Object {$_ -match '^\d+;\s+.*\bSCHEMA - public(?:\s|$)'})
 if($publicEntries.Count -ne 1){throw 'Source public schema entry missing or ambiguous'}
 $filtered=@($toc|ForEach-Object {if($_ -match '^\d+;\s+.*\bSCHEMA - public(?:\s|$)'){';'+$_}else{$_}})
 [IO.File]::WriteAllLines($selection,$filtered,(New-Object Text.UTF8Encoding($false)))
 & (Join-Path $bin 'pg_restore.exe') --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error --use-list $selection -w -h 127.0.0.1 -p $port -U inkr_g4_rehearsal -d inkr_real_snapshot_copy $dump *> $restoreLog
 if($LASTEXITCODE -ne 0){throw 'Restoring real snapshot into disposable database failed'}
 $query=@'
select json_build_object(
 'appointments',(select count(*) from public.appointments),
 'requests',(select count(*) from public.tattoo_requests),
 'templates',(select count(*) from public.message_templates),
 'auth_users',(select count(*) from auth.users),
 'storage_objects',(select count(*) from storage.objects),
 'public_tables',(select count(*) from pg_tables where schemaname='public'),
 'fingerprint',(select md5(coalesce(string_agg(id::text||':'||status||':'||to_char(starts_at at time zone 'UTC','YYYYMMDDHH24MISS.US')||':'||to_char(ends_at at time zone 'UTC','YYYYMMDDHH24MISS.US'),';' order by id),'empty')) from public.appointments),
 'deposits_table',to_regclass('public.appointment_deposit_requests') is not null,
 'stripe_event_table',to_regclass('public.stripe_subscription_events') is not null
);
'@
 function Get-Counts {
  $lines=@(& $psql @common -A -t -c $query)
  if($LASTEXITCODE -ne 0){throw 'Could not read snapshot table/fingerprint counts'}
  $json=($lines|Where-Object { $_.TrimStart().StartsWith('{') }|Select-Object -Last 1)
  if(!$json){throw 'Count JSON unavailable'}
  return ($json|ConvertFrom-Json)
 }
 $before=Get-Counts
 if($before.appointments -ne 2 -or $before.requests -ne 4 -or $before.templates -ne 7 -or $before.auth_users -ne 7 -or $before.storage_objects -ne 3 -or $before.public_tables -ne 36 -or $before.fingerprint -ne 'a5139386f5dfd60a76965d7240d38160'){throw 'Historical snapshot baseline mismatch'}
 if($before.deposits_table -or $before.stripe_event_table){throw 'Unexpected prior migration schema'}
 Write-Output ('G4_REAL_SNAPSHOT_RESTORED=PASS PUBLIC_TABLES='+$before.public_tables+' APPOINTMENTS='+$before.appointments+' REQUESTS='+$before.requests)
 $migrations=@(Get-ChildItem (Join-Path $repo 'supabase\migrations') -Filter '202611*.sql' -File|Sort-Object Name)
 if($migrations.Count -ne 12){throw 'Expected exactly 12 post-production migrations, got '+$migrations.Count}
 $args=@($common)+@('-1')
 foreach($m in $migrations){$args+=@('-f',$m.FullName)}
 # Test the migrated schema while all changes are still in the same transaction.
 $probe=@'
select 'G4_TRANSACTION_PROBE='||json_build_object(
 'public_tables',(select count(*) from pg_tables where schemaname='public'),
 'appointment_count',(select count(*) from public.appointments),
 'request_count',(select count(*) from public.tattoo_requests),
 'template_count',(select count(*) from public.message_templates),
 'auth_user_count',(select count(*) from auth.users),
 'storage_object_count',(select count(*) from storage.objects),
 'deposit_table',to_regclass('public.appointment_deposit_requests') is not null,
 'stripe_table',to_regclass('public.stripe_subscription_events') is not null,
 'fingerprint',(select md5(coalesce(string_agg(id::text||':'||status||':'||to_char(starts_at at time zone 'UTC','YYYYMMDDHH24MISS.US')||':'||to_char(ends_at at time zone 'UTC','YYYYMMDDHH24MISS.US'),';' order by id),'empty')) from public.appointments)
);
'@
 $args+=@('-c',$probe,'-c','ROLLBACK;')
 $previousErrorPreference=$ErrorActionPreference
 try {
  $ErrorActionPreference='Continue' # PostgreSQL NOTICE on stderr is not a SQL failure.
  & $psql @args *> $migrationLog
  $migrationExit=$LASTEXITCODE
 } finally { $ErrorActionPreference=$previousErrorPreference }
 if($migrationExit -ne 0){
  $last=@(Get-Content $migrationLog -Tail 14|Where-Object {$_ -match 'ERROR:|FATAL:|psql:|ERROR|LINE'})
  $report.migration_replay_error_summary=($last|Select-Object -Last 3) -join ' | '
  throw ('Historical snapshot migration replay failed at PostgreSQL exit '+$migrationExit)
 }
 $line=@(Get-Content $migrationLog|ForEach-Object {$_.Trim()}|Where-Object {$_ -like 'G4_TRANSACTION_PROBE=*'}|Select-Object -Last 1)
 if($line.Count -ne 1){throw 'No pre-rollback migration state reported'}
 $during=$line[0].Substring('G4_TRANSACTION_PROBE='.Length)|ConvertFrom-Json
 if($during.appointment_count -ne $before.appointments -or $during.request_count -ne $before.requests -or $during.template_count -ne $before.templates -or $during.auth_user_count -ne $before.auth_users -or $during.storage_object_count -ne $before.storage_objects -or $during.fingerprint -ne $before.fingerprint){throw 'Migration changed historical appointments or requests'}
 if(!$during.deposit_table -or !$during.stripe_table){throw 'Expected migrated schema not materialized'}
 $after=Get-Counts
 if($after.public_tables -ne $before.public_tables -or $after.fingerprint -ne $before.fingerprint -or $after.requests -ne $before.requests -or $after.appointments -ne $before.appointments -or $after.templates -ne $before.templates -or $after.auth_users -ne $before.auth_users -or $after.storage_objects -ne $before.storage_objects -or $after.deposits_table -or $after.stripe_event_table){throw 'Post-ROLLBACK historical state differs'}
 $report.status='PASS_REAL_PRODUCTION_SNAPSHOT_MIGRATION_TRANSACTION_ROLLBACK'
 $report.migration_count=$migrations.Count
 $report.historical_fingerprint_preserved=$true
 $report.transactional_rollback_tested=$true
 $report.public_tables_before=$before.public_tables
 $report.public_tables_migrated=$during.public_tables
 $report.public_tables_after_rollback=$after.public_tables
 Write-Output ('G4_REAL_SNAPSHOT_12_MIGRATIONS=PASS tables_before='+$before.public_tables+' tables_during='+$during.public_tables+' tables_after_rollback='+$after.public_tables)
}catch{
 $report.reason=[string]$_.Exception.Message
 Write-Output ('G4_REAL_SNAPSHOT_REHEARSAL=HOLD '+$report.reason)
}finally{
 if($started -and (Test-Path (Join-Path $pg 'postmaster.pid'))){try{& (Join-Path $bin 'pg_ctl.exe') -D $pg -w stop -m fast}catch{Write-Output 'G4_TEST_POSTGRES_STOP_HOLD'}}
 Remove-Item Env:PGPASSWORD,Env:PGSSLMODE,Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue
 if(Test-Path $work){Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue}
 $report.plaintext_removed=!(Test-Path $work)
 $report.finished_at=(Get-Date).ToString('o')
 [IO.File]::WriteAllText($reportPath,($report|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
 Write-Output ('G4_DISPOSABLE_WORK_CLEANED='+$report.plaintext_removed)
}
if($report.status -ne 'PASS_REAL_PRODUCTION_SNAPSHOT_MIGRATION_TRANSACTION_ROLLBACK' -or !$report.plaintext_removed){exit 1}
