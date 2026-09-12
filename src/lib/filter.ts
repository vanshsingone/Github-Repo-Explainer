export function isIgnoredPath(path: string): boolean {
  const ignoredDirectories = [
    "node_modules",
    "dist",
    "vendor",
    "build",
    ".git",
    ".next",
    ".cache",
  ];

  const ignoredPatterns = [
    "*.lock",
    "*.lockb",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
  ];

  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp"];
  const binaryExtensions = [".pdf", ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dll", ".so"];
  const dotGitignorePatterns = [".gitignore"];

  // Check if path is in ignored directory
  for (const dir of ignoredDirectories) {
    if (path.startsWith(dir + "/") || path === dir) {
      return true;
    }
  }

  // Check ignored patterns
  for (const pattern of ignoredPatterns) {
    if (path === pattern) return true;
  }

  // Check image extensions
  for (const ext of imageExtensions) {
    if (path.endsWith(ext)) return true;
  }

  // Check binary extensions
  for (const ext of binaryExtensions) {
    if (path.endsWith(ext)) return true;
  }

  // Check .gitignore-style patterns
  for (const pat of dotGitignorePatterns) {
    if (path === pat) return true;
  }

  return false;
}
