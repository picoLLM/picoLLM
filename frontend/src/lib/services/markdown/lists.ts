import { PATTERNS } from '$lib/constants/markdown.constants';

interface ListCallbacks {
  onCodeBlock: (id: string, content: string, language: string) => void;
  onTable: (id: string, content: string) => void;
  createBlockId: (index: number) => string;
  createTableId: (index: number) => string;
  blockIndex: () => number;
  processInline?: (text: string) => string;
}

interface ListLevel {
  type: 'ol' | 'ul';
  indent: number;
  items: string[];
}

export class ListProcessor {
  processLists(input: string, callbacks: ListCallbacks): string {
    const lines = input.split('\n');
    const output: string[] = [];
    const listStack: ListLevel[] = [];
    let i = 0;

    const processContent = (content: string): string => {
      return callbacks.processInline ? callbacks.processInline(content) : content;
    };

    const closeListsToLevel = (targetIndent: number) => {
      while (listStack.length > 0 && listStack[listStack.length - 1].indent > targetIndent) {
        const list = listStack.pop()!;
        const tag = list.type;
        const cls = list.type === 'ol' ? 'markdown-list ordered' : 'markdown-list';
        const html = `<${tag} class="${cls}">${list.items.join('')}</${tag}>`;
        
        if (listStack.length > 0) {
          const parent = listStack[listStack.length - 1];
          const lastIdx = parent.items.length - 1;
          parent.items[lastIdx] = parent.items[lastIdx].replace('</li>', `${html}</li>`);
        } else {
          output.push(html);
        }
      }
    };

    const closeAllLists = () => {
      while (listStack.length > 0) {
        const list = listStack.pop()!;
        const tag = list.type;
        const cls = list.type === 'ol' ? 'markdown-list ordered' : 'markdown-list';
        const html = `<${tag} class="${cls}">${list.items.join('')}</${tag}>`;
        
        if (listStack.length > 0) {
          const parent = listStack[listStack.length - 1];
          const lastIdx = parent.items.length - 1;
          parent.items[lastIdx] = parent.items[lastIdx].replace('</li>', `${html}</li>`);
        } else {
          output.push(html);
        }
      }
    };

    while (i < lines.length) {
      const line = lines[i];
      const orderedMatch = line.match(PATTERNS.lists.ordered);
      const unorderedMatch = line.match(PATTERNS.lists.unordered);

      if (orderedMatch || unorderedMatch) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const content = orderedMatch?.[3] || unorderedMatch?.[2] || '';
        const processedContent = processContent(content);
        const type = orderedMatch ? 'ol' : 'ul';
        
        // Only close lists that are deeper than current indent
        closeListsToLevel(indent);

        let listItem = orderedMatch
          ? `<li value="${orderedMatch[2]}" class="markdown-list-item">${processedContent}</li>`
          : `<li class="markdown-list-item">${processedContent}</li>`;

        // Check if we can add to existing list at this level
        let added = false;
        for (let j = listStack.length - 1; j >= 0; j--) {
          if (listStack[j].indent === indent && listStack[j].type === type) {
            // Found matching list at same level
            listStack[j].items.push(listItem);
            added = true;
            break;
          } else if (listStack[j].indent < indent) {
            // This should be a nested list
            break;
          }
        }

        if (!added) {
          // Need to create new list
          if (listStack.length > 0 && listStack[listStack.length - 1].indent < indent) {
            // Nested list
            listStack.push({ type, indent, items: [listItem] });
          } else {
            // New list at current level
            listStack.push({ type, indent, items: [listItem] });
          }
        }
        i++;
      } else if (listStack.length > 0 && line.trim()) {
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
        const currentList = listStack[listStack.length - 1];
        
        if (leadingSpaces > currentList.indent) {
          const content = line.trim();
          const processed = processContent(content);
          const lastIdx = currentList.items.length - 1;
          
          currentList.items[lastIdx] = currentList.items[lastIdx].replace(
            '</li>', 
            `<br>${processed}</li>`
          );
          i++;
        } else {
          closeAllLists();
          output.push(line);
          i++;
        }
      } else if (line.trim() === '') {
        // Empty line - check if next line continues the list
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextIslist = PATTERNS.lists.ordered.test(nextLine) || PATTERNS.lists.unordered.test(nextLine);
          
          if (!nextIslist) {
            // Next line is not a list, close all lists
            closeAllLists();
          }
        }
        output.push(line);
        i++;
      } else {
        closeAllLists();
        output.push(line);
        i++;
      }
    }

    closeAllLists();
    return output.join('\n');
  }
}