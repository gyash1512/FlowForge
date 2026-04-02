import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { generateProjectFiles } from '../commands/init.js';

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('generateProjectFiles', () => {
    it('should return all required project files', () => {
      const files = generateProjectFiles('test-project');

      expect(files).toHaveProperty('package.json');
      expect(files).toHaveProperty('tsconfig.json');
      expect(files).toHaveProperty('.env.example');
      expect(files).toHaveProperty('.gitignore');
      expect(files).toHaveProperty('src/workflows/example.workflow.ts');
    });

    it('should set the project name in package.json', () => {
      const files = generateProjectFiles('my-workflows');
      const pkg = JSON.parse(files['package.json']!);

      expect(pkg.name).toBe('my-workflows');
    });

    it('should produce valid JSON for package.json', () => {
      const files = generateProjectFiles('test-project');
      const pkg = JSON.parse(files['package.json']!);

      expect(pkg.version).toBe('0.1.0');
      expect(pkg.type).toBe('module');
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.dev).toBe('conduit dev');
      expect(pkg.scripts.deploy).toBe('conduit deploy');
      expect(pkg.dependencies).toHaveProperty('@flowforge/sdk');
      expect(pkg.dependencies).toHaveProperty('@flowforge/shared');
    });

    it('should produce valid JSON for tsconfig.json', () => {
      const files = generateProjectFiles('test-project');
      const tsconfig = JSON.parse(files['tsconfig.json']!);

      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.include).toContain('src');
    });

    it('should include common entries in .gitignore', () => {
      const files = generateProjectFiles('test-project');
      const gitignore = files['.gitignore']!;

      expect(gitignore).toContain('node_modules');
      expect(gitignore).toContain('dist');
      expect(gitignore).toContain('.env');
    });

    it('should include environment variable placeholders in .env.example', () => {
      const files = generateProjectFiles('test-project');
      const envExample = files['.env.example']!;

      expect(envExample).toContain('CONDUIT_WORKER_PORT');
      expect(envExample).toContain('REDIS_HOST');
      expect(envExample).toContain('DATABASE_URL');
    });

    it('should generate a sample workflow file', () => {
      const files = generateProjectFiles('test-project');
      const workflow = files['src/workflows/example.workflow.ts']!;

      expect(workflow).toContain('example-workflow');
      expect(workflow).toContain('handler');
      expect(workflow).toContain("import { z } from 'zod'");
    });
  });

  describe('file writing', () => {
    it('should write all generated files to disk', () => {
      const files = generateProjectFiles('test-project');

      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(tmpDir, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf-8');
      }

      expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'tsconfig.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.env.example'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'src/workflows/example.workflow.ts'))).toBe(true);
    });

    it('should write valid parseable JSON files', () => {
      const files = generateProjectFiles('test-project');

      for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(tmpDir, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf-8');
      }

      const pkgContent = fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8');
      expect(() => JSON.parse(pkgContent)).not.toThrow();

      const tsconfigContent = fs.readFileSync(path.join(tmpDir, 'tsconfig.json'), 'utf-8');
      expect(() => JSON.parse(tsconfigContent)).not.toThrow();
    });
  });
});
