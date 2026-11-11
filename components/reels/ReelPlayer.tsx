import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface ReelPlayerProps {
  uri: string;
  /** Plays while true, pauses otherwise (the reel currently on screen). */
  active: boolean;
  muted: boolean;
  accessibilityLabel?: string;
}

/** Looping, chromeless player for an uploaded reel. Mount it only for reels near the screen. */
export function ReelPlayer({ uri, active, muted, accessibilityLabel }: ReelPlayerProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    // Browsers only allow autoplay without sound; the viewer unmutes on demand.
    instance.muted = true;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      playsInline
      accessibilityLabel={accessibilityLabel}
    />
  );
}
