import React, { useState } from 'react';
import {
  TextInput,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
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
  ...props
}: TInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <TText variant="caption" color="secondary" style={styles.label}>
            {label}
          </TText>
          {optional && (
            <TText variant="caption" color="tertiary" style={styles.optional}>
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightElement && <View style={styles.right}>{rightElement}</View>}
      </View>
      {error ? (
        <TText variant="caption" color="error" style={styles.message}>
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
    marginBottom: Spacing['3xs'],
  },
  label: {
    marginBottom: 2,
  },
  optional: {},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: Spacing.sm,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: Colors.accent,
  },
  inputError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    paddingVertical: Spacing['2xs'],
  },
  right: {
    marginLeft: Spacing['2xs'],
  },
  message: {
    marginTop: 4,
  },
});
