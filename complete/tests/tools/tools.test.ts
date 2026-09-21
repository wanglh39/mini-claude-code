import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { readTool, executeRead } from "../../src/tools/read.js";
import { writeTool, executeWrite } from "../../src/tools/write.js";
import { editTool, executeEdit } from "../../src/tools/edit.js";
import { globTool, executeGlob } from "../../src/tools/glob.js";
import { grepTool, executeGrep } from "../../src/tools/grep.js";
import { executeBash } from "../../src/tools/bash.js";

const TMP_DIR = path.resolve("./tests/tmp");

before(() => {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
});

after(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

// ============================================================================
// read_file
// ============================================================================

describe("read_file", () => {
  it("工具定义正确", () => {
    assert.equal(readTool.name, "read_file");
    assert.ok(readTool.input_schema.properties?.path);
  });

  it("读取存在的文件", () => {
    const p = path.join(TMP_DIR, "test.txt");
    fs.writeFileSync(p, "hello world");
    const result = executeRead({ path: p });
    assert.equal(result, "hello world");
  });

  it("读取不存在的文件返回错误", () => {
    const result = executeRead({ path: path.join(TMP_DIR, "noexist.txt") });
    assert.ok(result.startsWith("错误"));
  });

  it("大文件截断到 2000 行", () => {
    const p = path.join(TMP_DIR, "big.txt");
    fs.writeFileSync(p, Array(3000).fill("line").join("\n"));
    const result = executeRead({ path: p });
    assert.ok(result.includes("截断"));
  });
});

// ============================================================================
// write_file
// ============================================================================

describe("write_file", () => {
  it("工具定义正确", () => {
    assert.equal(writeTool.name, "write_file");
  });

  it("写入新文件", () => {
    const p = path.join(TMP_DIR, "new.txt");
    const result = executeWrite({ path: p, content: "test content" });
    assert.equal(fs.readFileSync(p, "utf-8"), "test content");
    assert.ok(result.includes("已成功写入"));
  });

  it("覆盖已有文件", () => {
    const p = path.join(TMP_DIR, "overwrite.txt");
    fs.writeFileSync(p, "old");
    executeWrite({ path: p, content: "new" });
    assert.equal(fs.readFileSync(p, "utf-8"), "new");
  });

  it("自动创建中间目录", () => {
    const p = path.join(TMP_DIR, "sub", "dir", "file.txt");
    executeWrite({ path: p, content: "nested" });
    assert.equal(fs.readFileSync(p, "utf-8"), "nested");
  });
});

// ============================================================================
// edit_file
// ============================================================================

describe("edit_file", () => {
  it("工具定义正确", () => {
    assert.equal(editTool.name, "edit_file");
  });

  it("精确替换", () => {
    const p = path.join(TMP_DIR, "edit.txt");
    fs.writeFileSync(p, "hello old world");
    const result = executeEdit({ path: p, oldString: "old", newString: "new" });
    assert.equal(fs.readFileSync(p, "utf-8"), "hello new world");
    assert.ok(result.includes("已成功编辑"));
  });

  it("未找到匹配返回错误", () => {
    const p = path.join(TMP_DIR, "edit2.txt");
    fs.writeFileSync(p, "hello world");
    const result = executeEdit({ path: p, oldString: "xxx", newString: "yyy" });
    assert.ok(result.includes("未找到"));
  });

  it("多处匹配返回错误", () => {
    const p = path.join(TMP_DIR, "edit3.txt");
    fs.writeFileSync(p, "a a a");
    const result = executeEdit({ path: p, oldString: "a", newString: "b" });
    assert.ok(result.includes("不唯一"));
  });
});

// ============================================================================
// glob
// ============================================================================

describe("glob", () => {
  it("工具定义正确", () => {
    assert.equal(globTool.name, "glob");
  });

  it("匹配 .txt 文件", () => {
    fs.writeFileSync(path.join(TMP_DIR, "a.txt"), "");
    fs.writeFileSync(path.join(TMP_DIR, "b.txt"), "");
    fs.writeFileSync(path.join(TMP_DIR, "c.log"), "");
    const result = executeGlob({ pattern: "*.txt", cwd: TMP_DIR });
    assert.ok(result.includes("a.txt"));
    assert.ok(result.includes("b.txt"));
    assert.ok(!result.includes("c.log"));
  });

  it("无匹配返回提示", () => {
    const result = executeGlob({ pattern: "*.xyz", cwd: TMP_DIR });
    assert.ok(result.includes("未找到"));
  });
});

// ============================================================================
// grep
// ============================================================================

describe("grep", () => {
  it("工具定义正确", () => {
    assert.equal(grepTool.name, "grep");
  });

  it("搜索匹配内容", () => {
    fs.writeFileSync(path.join(TMP_DIR, "search.txt"), "hello world\nfoo bar");
    const result = executeGrep({ pattern: "hello", cwd: TMP_DIR });
    assert.ok(result.includes("hello world"));
    assert.ok(result.includes("search.txt"));
  });

  it("无匹配返回提示", () => {
    const result = executeGrep({ pattern: "zzzzz", cwd: TMP_DIR });
    assert.ok(result.includes("未找到"));
  });

  it("include 过滤文件类型", () => {
    fs.writeFileSync(path.join(TMP_DIR, "code.ts"), "import foo");
    fs.writeFileSync(path.join(TMP_DIR, "code.js"), "import bar");
    const result = executeGrep({ pattern: "import", include: "*.ts", cwd: TMP_DIR });
    assert.ok(result.includes("code.ts"));
    assert.ok(!result.includes("code.js"));
  });
});

// ============================================================================
// bash
// ============================================================================

describe("bash", () => {
  it("执行简单命令", async () => {
    const result = await executeBash({ command: "echo hello" });
    assert.ok(result.includes("hello"));
  });

  it("捕获 stderr", async () => {
    const result = await executeBash({ command: "node -e \"process.stderr.write('err')\"" });
    assert.ok(result.includes("err"));
  });

  it("超时处理", async () => {
    const result = await executeBash({ command: "node -e \"setTimeout(()=>{},5000)\"", timeout: 500 });
    assert.ok(result.includes("exit") || result.includes("err"));
  });
});