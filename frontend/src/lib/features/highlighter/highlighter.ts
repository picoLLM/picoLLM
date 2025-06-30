import hljs from 'highlight.js';
import type { Props } from './highlighter.types';
import { UI_CONSTANTS } from './highlighter.constants';

/**
 * Optimized syntax highlighting service
 */
export class SyntaxHighlightService {
    static readonly COPY_TIMEOUT = UI_CONSTANTS.COPY_TIMEOUT;
    static readonly ERROR_TIMEOUT = UI_CONSTANTS.ERROR_TIMEOUT;
    static readonly COPY_ICON = UI_CONSTANTS.COPY_ICON;
    
    private static langCache = new Map<string, string>();
    private static hlCache = new Map<string, string>();
    private static readonly CACHE_SIZE = 50;

    /**
     * Configure hljs with optimized settings
     */
    private static configure(language: string): string {
        const lang = language.toLowerCase().trim();
        if (!this.langCache.has(lang)) {
            hljs.configure({
                classPrefix: 'hljs-',
                languages: [lang],
                cssSelector: 'pre code',
                ignoreUnescapedHTML: true
            });
            this.langCache.set(lang, lang);
        }
        return lang;
    }

    /**
     * Main highlight method with caching
     */
    static highlight(code: string, language: string): string {
        if (!code.trim()) return '';
        
        const key = `${language}:${code}`;
        if (this.hlCache.has(key)) return this.hlCache.get(key)!;
        
        try {
            const normalized = this.normalizeIndentation(code).replace(/\n\s*$/, '');
            const lang = this.configure(language);
            
            let result = hljs.getLanguage(lang)
                ? hljs.highlight(normalized, { language: lang, ignoreIllegals: true }).value
                : hljs.highlightAuto(normalized).value;
            
            if (lang === 'python') {
                result = result
                    .replace(/<span class="hljs-keyword">(import|from|as)<\/span>/g,
                        '<span class="hljs-keyword" data-keyword="$1">$1</span>')
                    .replace(/(<span class="hljs-keyword" data-keyword="(?:import|from)">(?:import|from)<\/span>\s+)([a-zA-Z_][\w.]*)/g,
                        '$1<span class="hljs-name module-name">$2</span>');
            }
            
            this.addToCache(key, result);
            return result;
        } catch (error) {
            console.error('Highlighting failed:', error);
            return code;
        }
    }

    /**
     * Efficient cache management
     */
    private static addToCache(key: string, value: string): void {
        if (this.hlCache.size >= this.CACHE_SIZE) {
            this.hlCache.delete(this.hlCache.keys().next().value!);
        }
        this.hlCache.set(key, value);
    }

    /**
     * Optimized indentation normalization
     */
    private static normalizeIndentation(code: string): string {
        const lines = code.split('\n');
        if (!lines.length) return '';
        
        const indents = lines.filter(l => l.trim()).map(l => l.match(/^\s*/)?.[0].length || 0);
        const min = Math.min(...indents);
        
        return min === Infinity || !min ? code : lines.map(l => l.trim() ? l.slice(min) : l).join('\n');
    }

    /**
     * Validate and normalize language with caching
     */
    static getLanguage(lang: string): string {
        const normalized = lang.toLowerCase().trim();
        if (this.langCache.has(normalized)) return this.langCache.get(normalized)!;
        
        const result = hljs.getLanguage(normalized) ? normalized : 'plaintext';
        this.langCache.set(normalized, result);
        return result;
    }
    
    static getDisplayLanguage(lang: string): string {
        return this.getLanguage(lang);
    }

    /**
     * Optimized line number generation
     */
    static addLineNumbers(code: string, showNumbers: boolean): string {
        if (!showNumbers || !code) return code;
        
        const lines = code.split('\n');
        if (lines.at(-1)?.trim() === '') lines.pop();
        
        const digits = Math.floor(Math.log10(lines.length)) + 1;
        
        return lines.map((line, i) => 
            `<span class="line-number" style="width: ${digits}em">${
                (i + 1).toString().padStart(digits)
            }</span>${line}`
        ).join('\n');
    }
    
    /**
     * Optimized style string generation
     */
    static generateStyleString(themeVars: any, syntaxColors: any, vscodeColors: any): string {
        const vars = [
            ...Object.entries(themeVars).map(([k, v]) => 
                `--${k.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`)}: ${v}`),
            ...Object.entries(syntaxColors).map(([k, v]) => `--syntax-${k}: ${v}`),
            ...Object.entries(vscodeColors).map(([k, v]) => `--vscode-${k}: ${v}`)
        ];
        return vars.join('; ') + ';';
    }
    
    /**
     * Optimized clipboard operations
     */
    static async copyCodeToClipboard(code: string): Promise<boolean> {
        if (!code) return false;
        
        const text = code.trim();
        
        try {
            if (navigator.clipboard?.writeText && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            
            const textarea = Object.assign(document.createElement('textarea'), {
                value: text,
                style: { position: 'fixed', left: '-999999px' }
            });
            
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            textarea.remove();
            
            return success;
        } catch (err) {
            console.error('Copy failed:', err);
            return false;
        }
    }
}

/**
 * Svelte action for code highlighting
 */
export function codeHighlighter(node: HTMLElement, props: Props) {
    const { code = '', language = '', langtag = false, messageId, showLineNumbers = true, theme = 'dark' } = props;
    
    let highlightedCode = '';
    let prevCode = '';
    let prevLang = '';
    
    function update() {
        if (!code || (code === prevCode && language === prevLang)) return;
        
        highlightedCode = SyntaxHighlightService.highlight(code, language);
        prevCode = code;
        prevLang = language;
        
        const codeEl = node.querySelector('code');
        if (codeEl) {
            codeEl.innerHTML = SyntaxHighlightService.addLineNumbers(highlightedCode, showLineNumbers);
        }
    }
    
    update();
    
    return {
        update(newProps: Partial<Props>) {
            Object.assign(props, newProps);
            update();
        },
        destroy() {}
    };
}