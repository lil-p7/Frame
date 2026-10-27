import type { StaticNode } from "@/features/component-registry/staticTree";

/**
 * JSX source serialization of the shared static tree (spec §23).
 *
 * The exported site is a React project, so the same tree the preview renders
 * is emitted as JSX source. Everything that comes from the document is
 * written as a JavaScript string literal — text, attribute values — so no
 * document content can escape the expression and become markup or script,
 * regardless of what an imported project contains (spec §23 "Security",
 * §32). Nothing here uses `dangerouslySetInnerHTML`.
 */

const INDENT = "  ";

/** One element and its children as JSX source at the given depth. */
export function jsxElement(node: StaticNode, depth: number): string {
  const pad = INDENT.repeat(depth);
  const attributes = attributesSource(node);
  const open = `<${node.element.tag}${attributes}`;

  if (node.element.voidElement === true) return `${pad}${open} />`;

  const text = node.element.text ?? "";
  if (node.children.length === 0) {
    return `${pad}${open}>{${literal(text)}}</${node.element.tag}>`;
  }

  const inner = node.children.map((child) => jsxElement(child, depth + 1)).join("\n");
  const leading = text === "" ? "" : `${literal(text)}\n`;
  return `${pad}${open}>\n${leading}${inner}\n${pad}</${node.element.tag}>`;
}

/** JSX attribute list, with the generated class first and values quoted safely. */
function attributesSource(node: StaticNode): string {
  const entries: Array<[string, string]> = [["className", node.className]];
  for (const [name, value] of Object.entries(node.element.attrs ?? {})) {
    entries.push([attributeName(name), value]);
  }
  return entries.map(([name, value]) => ` ${name}={${literal(value)}}`).join("");
}

/** `className` is React's spelling for `class`; every other name is literal. */
function attributeName(name: string): string {
  return name === "class" ? "className" : name;
}

/** A JavaScript string literal — the only way document text reaches the output. */
export function literal(value: string): string {
  return JSON.stringify(value);
}
