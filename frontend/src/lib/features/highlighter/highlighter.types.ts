
export interface Props {
    code: string;
    language: string;
    langtag?: boolean;
    messageId: string;
    showLineNumbers?: boolean;
    theme?: Theme;
    isStreaming?: boolean;
}

export interface ThemeColors {
    background: string;
    text: string;
    border: string;
    button: string;
    buttonHover: string;
}

export interface ThemeState {
    theme: Theme;
    colorTheme: ColorTheme;
  }

  export interface ThemeConfiguration {
    [key: string]: ThemeColors;
  }
  
export type ColorTheme = 'custom' | 'vscode';
export type Theme = 'dark' | 'light';
