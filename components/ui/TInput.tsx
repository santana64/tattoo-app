import React, { useState } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Platform,
} from 'react-native';
import { Colors, Radius, Spacing, FontSize, Fonts } from '@/constants/theme';
import { TText } from './TText';

interface TInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  rightElement?: React.ReactNode;
  optional?: boolean;
}

export function TInput({
  label,
  error,
  helper,
  containerStyle,
  inputStyle,
  rightElement,
  optional = false,
  onFocus,
  onBlur,
  ...props
}: TInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <TText variant="caption" weight="medium" color="secondary">
            {label}
          </TText>
          {optional && (
            <TText variant="caption" color="tertiary">
              Optionnel
            </TText>
          )}
        </View>
      )}
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={Colors.textTertiary}
          selectionColor={Colors.accentWarm}
          accessibilityLabel={label ?? props.placeholder}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {rightElement && <View style={styles.right}>{rightElement}</View>}
      </View>
      {error ? (
        <TText variant="caption" color="error" style={styles.message} accessibilityLiveRegion="polite">
          {error}
        </TText>
      ) : helper ? (
        <TText variant="caption" color="tertiary" style={styles.message}>
          {helper}
        </TText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    minHeight: 54,
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.bgSurface,
  },
  inputError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.sans,
    fontSize: FontSize.body,
    paddingVertical: Spacing['2xs'],
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null),
  },
  right: {
    marginLeft: Spacing['2xs'],
  },
  message: {
    marginTop: 6,
  },
});
