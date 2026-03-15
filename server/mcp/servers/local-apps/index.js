/**
 * KAGE Local Apps MCP Server
 * Provides tools for launching and controlling local applications,
 * reading/writing Excel files, creating PowerPoint presentations,
 * and automating macOS/Windows tasks.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, extname, basename, resolve } from 'path';
import { platform, homedir } from 'os';

/**
 * Expand ~ and ~/ to home directory in file paths
 */
function expandPath(filePath) {
  if (!filePath) return filePath;
  if (filePath === '~') return homedir();
  if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2));
  return filePath;
}

// Lazy-loaded modules
let XLSX = null;
let PptxGenJS = null;

async function loadXLSX() {
  if (!XLSX) {
    XLSX = await import('xlsx');
    if (XLSX.default) XLSX = XLSX.default;
  }
  return XLSX;
}

async function loadPptxGenJS() {
  if (!PptxGenJS) {
    const mod = await import('pptxgenjs');
    PptxGenJS = mod.default || mod;
  }
  return PptxGenJS;
}

const IS_MAC = platform() === 'darwin';
const IS_WIN = platform() === 'win32';

// ── Tool Definitions ─────────────────────────────────────────────

const TOOLS = [
  {
    name: 'open_application',
    description: 'Launch a local application by name. On macOS uses "open -a", on Windows uses "start".',
    inputSchema: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name (e.g. "Microsoft Excel", "Google Chrome", "Finder")' },
        filePath: { type: 'string', description: 'Optional file path to open with the application' }
      },
      required: ['appName']
    }
  },
  {
    name: 'list_running_apps',
    description: 'List currently running applications on the system.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_installed_apps',
    description: 'List installed applications on the system.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional filter keyword to search applications' }
      }
    }
  },
  {
    name: 'run_applescript',
    description: 'Execute an AppleScript command on macOS. Can automate any macOS application (Finder, Safari, Mail, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'AppleScript code to execute' }
      },
      required: ['script']
    }
  },
  {
    name: 'send_keys_to_app',
    description: 'Send keystrokes or keyboard shortcuts to a running application.',
    inputSchema: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Target application name' },
        keys: { type: 'string', description: 'Keys to send (e.g. "command+s", "return", "Hello World")' },
        isShortcut: { type: 'boolean', description: 'If true, interpret as keyboard shortcut; if false, type as text' }
      },
      required: ['appName', 'keys']
    }
  },
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of the entire screen or a specific application window.',
    inputSchema: {
      type: 'object',
      properties: {
        outputPath: { type: 'string', description: 'Path to save the screenshot (PNG format)' },
        appName: { type: 'string', description: 'Optional: capture only this application\'s window' }
      },
      required: ['outputPath']
    }
  },
  {
    name: 'read_excel',
    description: 'Read data from an Excel (.xlsx/.xls/.csv) file. Returns sheet data as JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the Excel file' },
        sheetName: { type: 'string', description: 'Sheet name to read (defaults to first sheet)' },
        range: { type: 'string', description: 'Cell range to read (e.g. "A1:D10"). If omitted, reads all data.' },
        headers: { type: 'boolean', description: 'If true, first row is treated as headers (default: true)' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'write_excel',
    description: 'Create or modify an Excel (.xlsx) file. Can create new files or add/update sheets.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path for the output Excel file' },
        sheets: {
          type: 'array',
          description: 'Array of sheet definitions',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Sheet name' },
              data: {
                type: 'array',
                description: 'Array of row arrays or array of objects (if headers provided)',
                items: {}
              },
              headers: {
                type: 'array',
                description: 'Column headers (optional if data is array of objects)',
                items: { type: 'string' }
              }
            },
            required: ['name', 'data']
          }
        },
        appendToExisting: { type: 'boolean', description: 'If true and file exists, add sheets to existing workbook' }
      },
      required: ['filePath', 'sheets']
    }
  },
  {
    name: 'modify_excel_cells',
    description: 'Modify specific cells in an existing Excel file. Useful for updating values without rewriting the entire file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the Excel file' },
        sheetName: { type: 'string', description: 'Sheet name to modify (defaults to first sheet)' },
        changes: {
          type: 'array',
          description: 'Array of cell changes',
          items: {
            type: 'object',
            properties: {
              cell: { type: 'string', description: 'Cell reference (e.g. "A1", "B3")' },
              value: { description: 'New value for the cell (string, number, or boolean)' },
              formula: { type: 'string', description: 'Formula (e.g. "=SUM(A1:A10)"). Overrides value if provided.' }
            },
            required: ['cell']
          }
        }
      },
      required: ['filePath', 'changes']
    }
  },
  {
    name: 'create_presentation',
    description: 'Create a PowerPoint (.pptx) presentation with slides, text, images, charts, and tables.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Output path for the PPTX file' },
        title: { type: 'string', description: 'Presentation title' },
        author: { type: 'string', description: 'Author name' },
        slides: {
          type: 'array',
          description: 'Array of slide definitions',
          items: {
            type: 'object',
            properties: {
              layout: { type: 'string', enum: ['title', 'content', 'two_column', 'image', 'blank'], description: 'Slide layout type' },
              title: { type: 'string', description: 'Slide title' },
              subtitle: { type: 'string', description: 'Slide subtitle (for title layout)' },
              body: { type: 'string', description: 'Main body text' },
              bullets: { type: 'array', items: { type: 'string' }, description: 'Bullet point items' },
              imagePath: { type: 'string', description: 'Path to image file to include' },
              notes: { type: 'string', description: 'Speaker notes' },
              table: {
                type: 'object',
                properties: {
                  headers: { type: 'array', items: { type: 'string' } },
                  rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } }
                },
                description: 'Table data with headers and rows'
              },
              leftColumn: { type: 'string', description: 'Left column text (for two_column layout)' },
              rightColumn: { type: 'string', description: 'Right column text (for two_column layout)' }
            }
          }
        },
        theme: {
          type: 'object',
          properties: {
            primaryColor: { type: 'string', description: 'Primary color hex (default: "4F46E5")' },
            secondaryColor: { type: 'string', description: 'Secondary color hex (default: "7C3AED")' },
            fontFamily: { type: 'string', description: 'Font family (default: "Helvetica Neue")' }
          }
        }
      },
      required: ['filePath', 'slides']
    }
  },
  {
    name: 'read_presentation',
    description: 'Read and extract text content from a PowerPoint (.pptx) file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the PPTX file to read' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'open_file_with_default_app',
    description: 'Open a file with the system default application.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file to open' }
      },
      required: ['filePath']
    }
  },
  {
    name: 'get_app_windows',
    description: 'Get information about open windows of a specific application.',
    inputSchema: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name to query' }
      },
      required: ['appName']
    }
  },
  {
    name: 'control_app_window',
    description: 'Control an application window (minimize, maximize, close, move, resize).',
    inputSchema: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Application name' },
        action: { type: 'string', enum: ['minimize', 'maximize', 'close', 'move', 'resize', 'focus'], description: 'Window action' },
        x: { type: 'number', description: 'X position (for move action)' },
        y: { type: 'number', description: 'Y position (for move action)' },
        width: { type: 'number', description: 'Width (for resize action)' },
        height: { type: 'number', description: 'Height (for resize action)' }
      },
      required: ['appName', 'action']
    }
  }
];

// ── Tool Handlers ───────────────────────────────────────────────

async function handleOpenApplication({ appName, filePath }) {
  if (IS_MAC) {
    let cmd = `open -a "${appName}"`;
    if (filePath) cmd += ` "${expandPath(filePath)}"`;
    execSync(cmd);
    return { success: true, message: `Opened ${appName}${filePath ? ` with ${filePath}` : ''}` };
  } else if (IS_WIN) {
    let cmd = `start "" "${appName}"`;
    if (filePath) cmd = `start "" "${appName}" "${filePath}"`;
    execSync(cmd, { shell: true });
    return { success: true, message: `Opened ${appName}` };
  }
  throw new Error(`Unsupported platform: ${platform()}`);
}

async function handleListRunningApps() {
  if (IS_MAC) {
    const result = execSync(
      `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`,
      { encoding: 'utf-8' }
    ).trim();
    const apps = result.split(', ').sort();
    return { apps, count: apps.length };
  } else if (IS_WIN) {
    const result = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8' });
    const apps = [...new Set(result.split('\n').map(l => l.split(',')[0]?.replace(/"/g, '')).filter(Boolean))].sort();
    return { apps, count: apps.length };
  }
  throw new Error(`Unsupported platform: ${platform()}`);
}

async function handleListInstalledApps({ filter }) {
  if (IS_MAC) {
    let apps = readdirSync('/Applications')
      .filter(f => f.endsWith('.app'))
      .map(f => f.replace('.app', ''))
      .sort();
    if (filter) {
      const lf = filter.toLowerCase();
      apps = apps.filter(a => a.toLowerCase().includes(lf));
    }
    return { apps, count: apps.length };
  } else if (IS_WIN) {
    const result = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /v DisplayName 2>nul',
      { encoding: 'utf-8', shell: true }
    );
    let apps = result.split('\n')
      .filter(l => l.includes('DisplayName'))
      .map(l => l.split('REG_SZ')[1]?.trim())
      .filter(Boolean)
      .sort();
    if (filter) {
      const lf = filter.toLowerCase();
      apps = apps.filter(a => a.toLowerCase().includes(lf));
    }
    return { apps, count: apps.length };
  }
  throw new Error(`Unsupported platform: ${platform()}`);
}

async function handleRunAppleScript({ script }) {
  if (!IS_MAC) throw new Error('AppleScript is only available on macOS');
  const escaped = script.replace(/'/g, "'\\''");
  const result = execSync(`osascript -e '${escaped}'`, {
    encoding: 'utf-8',
    timeout: 30000
  }).trim();
  return { success: true, result };
}

async function handleSendKeysToApp({ appName, keys, isShortcut }) {
  if (IS_MAC) {
    let script;
    if (isShortcut) {
      // Parse shortcut like "command+s" → keystroke "s" using {command down}
      const parts = keys.toLowerCase().split('+');
      const key = parts.pop();
      const modifiers = parts.map(m => {
        const map = { command: 'command down', cmd: 'command down', shift: 'shift down', option: 'option down', alt: 'option down', control: 'control down', ctrl: 'control down' };
        return map[m] || `${m} down`;
      });
      const modStr = modifiers.length ? ` using {${modifiers.join(', ')}}` : '';
      script = `tell application "${appName}" to activate
delay 0.5
tell application "System Events" to keystroke "${key}"${modStr}`;
    } else {
      script = `tell application "${appName}" to activate
delay 0.5
tell application "System Events" to keystroke "${keys}"`;
    }
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf-8' });
    return { success: true, message: `Sent ${isShortcut ? 'shortcut' : 'text'} "${keys}" to ${appName}` };
  }
  throw new Error('send_keys_to_app is currently only supported on macOS');
}

async function handleTakeScreenshot({ outputPath, appName }) {
  const absPath = resolve(expandPath(outputPath));
  if (IS_MAC) {
    if (appName) {
      // Capture specific window
      const script = `tell application "${appName}" to activate
delay 0.5`;
      execSync(`osascript -e '${script}'`);
      execSync(`screencapture -l $(osascript -e 'tell application "System Events" to tell process "${appName}" to get id of window 1') "${absPath}" 2>/dev/null || screencapture -w "${absPath}"`);
    } else {
      execSync(`screencapture -x "${absPath}"`);
    }
    return { success: true, path: absPath };
  } else if (IS_WIN) {
    // PowerShell screenshot
    execSync(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bitmap = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bitmap.Save('${absPath}') }"`, { shell: true });
    return { success: true, path: absPath };
  }
  throw new Error(`Unsupported platform: ${platform()}`);
}

async function handleReadExcel({ filePath, sheetName, range, headers = true }) {
  const xlsx = await loadXLSX();
  const absPath = resolve(expandPath(filePath));
  if (!existsSync(absPath)) throw new Error(`File not found: ${absPath}`);

  const workbook = xlsx.readFile(absPath);
  const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error(`Sheet "${sheetName || 'first'}" not found`);

  const opts = { header: headers ? undefined : 1, range: range || undefined };
  const data = xlsx.utils.sheet_to_json(sheet, opts);
  const sheetRange = sheet['!ref'] || '';

  return {
    fileName: basename(absPath),
    sheetName: sheetName || workbook.SheetNames[0],
    allSheets: workbook.SheetNames,
    range: sheetRange,
    rowCount: data.length,
    data: data.slice(0, 500), // Limit to 500 rows for safety
    truncated: data.length > 500
  };
}

async function handleWriteExcel({ filePath, sheets, appendToExisting }) {
  const xlsx = await loadXLSX();
  const absPath = resolve(expandPath(filePath));
  let workbook;

  if (appendToExisting && existsSync(absPath)) {
    workbook = xlsx.readFile(absPath);
  } else {
    workbook = xlsx.utils.book_new();
  }

  for (const sheetDef of sheets) {
    let ws;
    if (sheetDef.headers && Array.isArray(sheetDef.data[0])) {
      // Array of arrays with explicit headers
      const aoa = [sheetDef.headers, ...sheetDef.data];
      ws = xlsx.utils.aoa_to_sheet(aoa);
    } else if (Array.isArray(sheetDef.data[0])) {
      // Array of arrays
      ws = xlsx.utils.aoa_to_sheet(sheetDef.data);
    } else {
      // Array of objects
      ws = xlsx.utils.json_to_sheet(sheetDef.data, {
        header: sheetDef.headers || undefined
      });
    }

    // Auto-size columns
    if (ws['!ref']) {
      const colRange = xlsx.utils.decode_range(ws['!ref']);
      ws['!cols'] = [];
      for (let c = colRange.s.c; c <= colRange.e.c; c++) {
        let maxWidth = 10;
        for (let r = colRange.s.r; r <= colRange.e.r; r++) {
          const cell = ws[xlsx.utils.encode_cell({ r, c })];
          if (cell && cell.v) {
            const len = String(cell.v).length;
            if (len > maxWidth) maxWidth = Math.min(len, 50);
          }
        }
        ws['!cols'].push({ wch: maxWidth + 2 });
      }
    }

    xlsx.utils.book_append_sheet(workbook, ws, sheetDef.name);
  }

  xlsx.writeFile(workbook, absPath);
  return {
    success: true,
    path: absPath,
    sheets: sheets.map(s => s.name),
    message: `Excel file saved: ${absPath}`
  };
}

async function handleModifyExcelCells({ filePath, sheetName, changes }) {
  const xlsx = await loadXLSX();
  const absPath = resolve(expandPath(filePath));
  if (!existsSync(absPath)) throw new Error(`File not found: ${absPath}`);

  const workbook = xlsx.readFile(absPath);
  const ws = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) throw new Error(`Sheet not found`);

  for (const change of changes) {
    const cellRef = change.cell.toUpperCase();
    if (change.formula) {
      ws[cellRef] = { t: 's', f: change.formula };
    } else if (change.value !== undefined) {
      const t = typeof change.value === 'number' ? 'n' : typeof change.value === 'boolean' ? 'b' : 's';
      ws[cellRef] = { t, v: change.value };
    }
  }

  xlsx.writeFile(workbook, absPath);
  return { success: true, modifiedCells: changes.length, path: absPath };
}

async function handleCreatePresentation({ filePath, title, author, slides, theme = {} }) {
  const PptxGenJSClass = await loadPptxGenJS();
  const pptx = new PptxGenJSClass();

  const primary = theme.primaryColor || '4F46E5';
  const secondary = theme.secondaryColor || '7C3AED';
  const font = theme.fontFamily || 'Helvetica Neue';

  if (title) pptx.title = title;
  if (author) pptx.author = author;
  pptx.layout = 'LAYOUT_16x9';

  for (const slideDef of slides) {
    const slide = pptx.addSlide();

    // Background
    if (slideDef.layout === 'title') {
      slide.background = { fill: primary };
    }

    // Title
    if (slideDef.title) {
      const isTitle = slideDef.layout === 'title';
      slide.addText(slideDef.title, {
        x: 0.5, y: isTitle ? 1.5 : 0.3,
        w: 9, h: isTitle ? 1.5 : 0.8,
        fontSize: isTitle ? 36 : 24,
        fontFace: font,
        color: isTitle ? 'FFFFFF' : '1F2937',
        bold: true,
        align: isTitle ? 'center' : 'left'
      });
    }

    // Subtitle
    if (slideDef.subtitle && slideDef.layout === 'title') {
      slide.addText(slideDef.subtitle, {
        x: 1, y: 3.2, w: 8, h: 0.8,
        fontSize: 18, fontFace: font, color: 'E0E7FF', align: 'center'
      });
    }

    // Body text
    if (slideDef.body) {
      slide.addText(slideDef.body, {
        x: 0.5, y: 1.3, w: 9, h: 3.5,
        fontSize: 16, fontFace: font, color: '374151', align: 'left',
        valign: 'top', wrap: true
      });
    }

    // Bullet points
    if (slideDef.bullets && slideDef.bullets.length > 0) {
      const bulletText = slideDef.bullets.map(b => ({
        text: b,
        options: { bullet: { code: '2022' }, fontSize: 16, color: '374151', breakLine: true }
      }));
      slide.addText(bulletText, {
        x: 0.7, y: 1.3, w: 8.5, h: 4,
        fontFace: font, valign: 'top', paraSpaceAfter: 8
      });
    }

    // Two columns
    if (slideDef.layout === 'two_column') {
      if (slideDef.leftColumn) {
        slide.addText(slideDef.leftColumn, {
          x: 0.5, y: 1.3, w: 4.2, h: 3.5,
          fontSize: 14, fontFace: font, color: '374151', valign: 'top', wrap: true
        });
      }
      if (slideDef.rightColumn) {
        slide.addText(slideDef.rightColumn, {
          x: 5.2, y: 1.3, w: 4.2, h: 3.5,
          fontSize: 14, fontFace: font, color: '374151', valign: 'top', wrap: true
        });
      }
    }

    // Image
    if (slideDef.imagePath && existsSync(resolve(expandPath(slideDef.imagePath)))) {
      const ext = extname(slideDef.imagePath).toLowerCase().replace('.', '');
      const imgData = readFileSync(resolve(expandPath(slideDef.imagePath)));
      slide.addImage({
        data: `image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imgData.toString('base64')}`,
        x: slideDef.layout === 'image' ? 1 : 5, y: slideDef.layout === 'image' ? 0.5 : 1.5,
        w: slideDef.layout === 'image' ? 8 : 4.5, h: slideDef.layout === 'image' ? 4.5 : 3,
        sizing: { type: 'contain' }
      });
    }

    // Table
    if (slideDef.table) {
      const tableRows = [];
      if (slideDef.table.headers) {
        tableRows.push(slideDef.table.headers.map(h => ({
          text: h, options: { bold: true, color: 'FFFFFF', fill: { color: primary }, fontSize: 12 }
        })));
      }
      if (slideDef.table.rows) {
        slideDef.table.rows.forEach((row, i) => {
          tableRows.push(row.map(cell => ({
            text: cell, options: { fontSize: 11, fill: { color: i % 2 === 0 ? 'F3F4F6' : 'FFFFFF' } }
          })));
        });
      }
      slide.addTable(tableRows, {
        x: 0.5, y: slideDef.title ? 1.3 : 0.5, w: 9,
        border: { pt: 0.5, color: 'D1D5DB' },
        fontFace: font, autoPage: true
      });
    }

    // Speaker notes
    if (slideDef.notes) {
      slide.addNotes(slideDef.notes);
    }
  }

  const absPath = resolve(expandPath(filePath));
  await pptx.writeFile({ fileName: absPath });
  return { success: true, path: absPath, slideCount: slides.length, message: `Presentation saved: ${absPath}` };
}

async function handleReadPresentation({ filePath }) {
  const absPath = resolve(expandPath(filePath));
  if (!existsSync(absPath)) throw new Error(`File not found: ${absPath}`);

  // Use AdmZip-like approach with Node.js built-in
  const { Unzip } = await import('node:zlib');
  // Actually, pptx is a zip file. We'll parse the XML directly.
  const { createReadStream } = await import('node:fs');

  // Use a simpler approach: read with xlsx which can also read some pptx metadata
  // For now, use a child process to extract text
  if (IS_MAC) {
    try {
      // Use textutil or unzip + grep approach
      const result = execSync(
        `cd /tmp && rm -rf _pptx_extract && mkdir _pptx_extract && cd _pptx_extract && unzip -o "${absPath}" -d . > /dev/null 2>&1 && cat ppt/slides/*.xml 2>/dev/null | sed 's/<[^>]*>//g' | sed '/^$/d'`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim();
      const slideTexts = result.split('\n').filter(l => l.trim());
      execSync('rm -rf /tmp/_pptx_extract');
      return {
        fileName: basename(absPath),
        content: slideTexts.join('\n'),
        message: 'Text extracted from presentation'
      };
    } catch (e) {
      return { fileName: basename(absPath), error: 'Could not parse PPTX content', raw: e.message };
    }
  }

  return { fileName: basename(absPath), error: 'PPTX reading not supported on this platform yet' };
}

async function handleOpenFileWithDefaultApp({ filePath }) {
  const absPath = resolve(expandPath(filePath));
  if (!existsSync(absPath)) throw new Error(`File not found: ${absPath}`);

  if (IS_MAC) {
    execSync(`open "${absPath}"`);
  } else if (IS_WIN) {
    execSync(`start "" "${absPath}"`, { shell: true });
  } else {
    execSync(`xdg-open "${absPath}"`);
  }
  return { success: true, message: `Opened ${basename(absPath)} with default application` };
}

async function handleGetAppWindows({ appName }) {
  if (IS_MAC) {
    const script = `
tell application "System Events"
  tell process "${appName}"
    set windowInfo to {}
    repeat with w in windows
      set end of windowInfo to {name of w, position of w, size of w}
    end repeat
    return windowInfo
  end tell
end tell`;
    try {
      const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf-8' }).trim();
      return { appName, windows: result, success: true };
    } catch (e) {
      return { appName, error: e.message, success: false };
    }
  }
  throw new Error('get_app_windows is currently only supported on macOS');
}

async function handleControlAppWindow({ appName, action, x, y, width, height }) {
  if (IS_MAC) {
    let script;
    switch (action) {
      case 'minimize':
        script = `tell application "${appName}" to set miniaturized of front window to true`;
        break;
      case 'maximize':
        script = `tell application "System Events" to tell process "${appName}"
  set position of front window to {0, 25}
  set size of front window to {1920, 1055}
end tell`;
        break;
      case 'close':
        script = `tell application "${appName}" to close front window`;
        break;
      case 'focus':
        script = `tell application "${appName}" to activate`;
        break;
      case 'move':
        script = `tell application "System Events" to tell process "${appName}" to set position of front window to {${x || 0}, ${y || 0}}`;
        break;
      case 'resize':
        script = `tell application "System Events" to tell process "${appName}" to set size of front window to {${width || 800}, ${height || 600}}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf-8' });
    return { success: true, message: `${action} performed on ${appName}` };
  }
  throw new Error('control_app_window is currently only supported on macOS');
}

// ── Handler Map ────────────────────────────────────────────────

const TOOL_HANDLERS = {
  open_application: handleOpenApplication,
  list_running_apps: handleListRunningApps,
  list_installed_apps: handleListInstalledApps,
  run_applescript: handleRunAppleScript,
  send_keys_to_app: handleSendKeysToApp,
  take_screenshot: handleTakeScreenshot,
  read_excel: handleReadExcel,
  write_excel: handleWriteExcel,
  modify_excel_cells: handleModifyExcelCells,
  create_presentation: handleCreatePresentation,
  read_presentation: handleReadPresentation,
  open_file_with_default_app: handleOpenFileWithDefaultApp,
  get_app_windows: handleGetAppWindows,
  control_app_window: handleControlAppWindow
};

// ── Server Setup ───────────────────────────────────────────────

const server = new Server(
  { name: 'local-apps', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

/**
 * Normalize arguments: handle snake_case → camelCase aliases
 * and common AI argument format variations.
 */
function normalizeArgs(name, args) {
  if (!args) return {};
  const normalized = { ...args };

  // Common aliases: snake_case → camelCase
  if (normalized.file_path && !normalized.filePath) normalized.filePath = normalized.file_path;
  if (normalized.app_name && !normalized.appName) normalized.appName = normalized.app_name;
  if (normalized.sheet_name && !normalized.sheetName) normalized.sheetName = normalized.sheet_name;
  if (normalized.output_path && !normalized.outputPath) normalized.outputPath = normalized.output_path;
  if (normalized.is_shortcut !== undefined && normalized.isShortcut === undefined) normalized.isShortcut = normalized.is_shortcut;
  if (normalized.append_to_existing !== undefined && normalized.appendToExisting === undefined) normalized.appendToExisting = normalized.append_to_existing;
  if (normalized.image_path && !normalized.imagePath) normalized.imagePath = normalized.image_path;
  if (normalized.left_column && !normalized.leftColumn) normalized.leftColumn = normalized.left_column;
  if (normalized.right_column && !normalized.rightColumn) normalized.rightColumn = normalized.right_column;

  // For write_excel: normalize various AI argument formats
  if (name === 'write_excel') {
    // AI sends { data: { sheetName: [...] } } instead of sheets array
    if (!normalized.sheets && normalized.data) {
      if (typeof normalized.data === 'object' && !Array.isArray(normalized.data)) {
        normalized.sheets = Object.entries(normalized.data).map(([sheetName, sheetData]) => ({
          name: sheetName,
          data: Array.isArray(sheetData) ? sheetData : (sheetData?.data || []),
        }));
      } else if (Array.isArray(normalized.data)) {
        normalized.sheets = [{ name: 'Sheet1', data: normalized.data }];
      }
    }
    // AI sends sheets as { "SheetName": { data: [...] } } object instead of array
    if (normalized.sheets && !Array.isArray(normalized.sheets)) {
      normalized.sheets = Object.entries(normalized.sheets).map(([sheetName, sheetData]) => {
        if (typeof sheetData === 'object' && !Array.isArray(sheetData) && sheetData.data) {
          return { name: sheetName, data: sheetData.data, headers: sheetData.headers };
        }
        return { name: sheetName, data: Array.isArray(sheetData) ? sheetData : [] };
      });
    }
  }

  // For create_presentation: normalize slide layouts
  if (name === 'create_presentation' && normalized.slides) {
    normalized.slides = normalized.slides.map(s => ({
      ...s,
      imagePath: s.imagePath || s.image_path || s.image,
      leftColumn: s.leftColumn || s.left_column || s.left,
      rightColumn: s.rightColumn || s.right_column || s.right,
    }));
  }

  return normalized;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = TOOL_HANDLERS[name];

  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true
    };
  }

  try {
    const normalizedArgs = normalizeArgs(name, args);
    const result = await handler(normalizedArgs);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// ── Start ──────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('KAGE Local Apps MCP Server running');
}

main().catch(console.error);
