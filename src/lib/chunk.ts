import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import crypto from "crypto";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Chunk {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName: string;
  language: string;
  content: string;
  contentHash: string;
}

// ============================================================================
// PARSER CACHE
// ============================================================================

const parsers = new Map<string, Parser>();

function getParser(language: string): Parser | null {
  if (parsers.has(language)) {
    return parsers.get(language)!;
  }

  const parser = new Parser();

  try {
    if (language === "typescript" || language === "javascript") {
      parser.setLanguage(TypeScript.typescript);
    } else if (language === "python") {
      parser.setLanguage(Python);
    } else {
      return null;
    }

    parsers.set(language, parser);
    return parser;
  } catch (error) {
    console.error(`Failed to initialize parser for ${language}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

export function parseFileWithTreeSitter(
  filePath: string,
  content: string,
  language: string
): Parser.Tree | null {
  const parser = getParser(language);

  if (!parser) {
    console.warn(`No parser available for language: ${language}`);
    return null;
  }

  try {
    const tree = parser.parse(content);
    return tree;
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

export function extractChunksFromAST(
  tree: Parser.Tree,
  filePath: string,
  language: string,
  content: string
): Chunk[] {
  const chunks: Chunk[] = [];

  function visit(node: Parser.SyntaxNode) {
    if (isFunctionOrClass(node, language)) {
      const chunk = createChunkFromNode(node, filePath, language, content);
      chunks.push(chunk);
    }

    for (const child of node.children) {
      visit(child);
    }
  }

  visit(tree.rootNode);
  return chunks;
}

export function calculateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isFunctionOrClass(node: Parser.SyntaxNode, language: string): boolean {
  if (language === "typescript" || language === "javascript") {
    return [
      "function_declaration",
      "method_definition",
      "class_declaration",
      "arrow_function",
      "function_expression",
    ].includes(node.type);
  }

  if (language === "python") {
    return ["function_definition", "class_definition"].includes(node.type);
  }

  return false;
}

function createChunkFromNode(
  node: Parser.SyntaxNode,
  filePath: string,
  language: string,
  content: string
): Chunk {
  const nodeContent = content.substring(node.startIndex, node.endIndex);
  const symbolName = getSymbolName(node, content, language) || "anonymous";

  return {
    filePath,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    symbolName,
    language,
    content: nodeContent,
    contentHash: calculateContentHash(nodeContent),
  };
}

function getSymbolName(
  node: Parser.SyntaxNode,
  content: string,
  language: string
): string | null {
  if (language === "typescript" || language === "javascript") {
    const identifier = node.children.find((n) => n.type === "identifier");
    if (identifier) {
      return content.substring(identifier.startIndex, identifier.endIndex);
    }
  }

  if (language === "python") {
    const identifier = node.children.find((n) => n.type === "identifier");
    if (identifier) {
      return content.substring(identifier.startIndex, identifier.endIndex);
    }
  }

  return null;
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
  };

  return languageMap[ext || ""] || "unknown";
}
