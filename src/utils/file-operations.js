/**
 * File Operations Utility
 * Centralized file I/O operations with error handling
 */

import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';
import XLSX from 'xlsx';
import PDFParse from 'pdf-parse';
import { createLogger } from './logger.js';
import { AppError, ValidationError } from './error-handler.js';

const logger = createLogger('FileOperations');

/**
 * Read and parse JSON configuration file
 */
export async function readJSONConfig(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const data = await fs.readFile(absolutePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`Configuration file not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new ValidationError(`Invalid JSON in file: ${filePath}`);
    }
    throw new AppError(`Failed to read configuration: ${error.message}`);
  }
}

/**
 * Write data as JSON to file
 */
export async function writeJSONData(filePath, data, pretty = true) {
  try {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    
    // Ensure directory exists
    await ensureDirectoryExists(dir);
    
    // Write file
    const jsonString = pretty 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    
    await fs.writeFile(absolutePath, jsonString, 'utf8');
    logger.info(`Data written to ${filePath}`);
    return absolutePath;
  } catch (error) {
    throw new AppError(`Failed to write JSON data: ${error.message}`);
  }
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectoryExists(dirPath) {
  try {
    const absolutePath = path.resolve(dirPath);
    await fs.mkdir(absolutePath, { recursive: true });
    return absolutePath;
  } catch (error) {
    throw new AppError(`Failed to create directory: ${error.message}`);
  }
}

/**
 * Parse CSV file with Papa Parse
 */
export async function parseCSVFile(filePath, options = {}) {
  try {
    const absolutePath = path.resolve(filePath);
    const csvData = await fs.readFile(absolutePath, 'utf8');
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: options.header !== false,
        dynamicTyping: options.dynamicTyping !== false,
        skipEmptyLines: options.skipEmptyLines !== false,
        ...options,
        complete: (results) => {
          if (results.errors.length > 0) {
            logger.warn('CSV parsing warnings', { errors: results.errors });
          }
          resolve(results.data);
        },
        error: (error) => {
          reject(new AppError(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`CSV file not found: ${filePath}`);
    }
    throw new AppError(`Failed to parse CSV: ${error.message}`);
  }
}

/**
 * Write data to CSV file
 */
export async function writeCSVData(filePath, data, options = {}) {
  try {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    
    await ensureDirectoryExists(dir);
    
    const csv = Papa.unparse(data, {
      header: options.header !== false,
      ...options
    });
    
    await fs.writeFile(absolutePath, csv, 'utf8');
    logger.info(`CSV written to ${filePath}`);
    return absolutePath;
  } catch (error) {
    throw new AppError(`Failed to write CSV: ${error.message}`);
  }
}

/**
 * Read Excel file and return workbook
 */
export async function readExcelFile(filePath, options = {}) {
  try {
    const absolutePath = path.resolve(filePath);
    const buffer = await fs.readFile(absolutePath);
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      ...options
    });
    
    return workbook;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`Excel file not found: ${filePath}`);
    }
    throw new AppError(`Failed to read Excel file: ${error.message}`);
  }
}

/**
 * Parse Excel sheet to JSON
 */
export async function parseExcelSheet(filePath, sheetName = null, options = {}) {
  try {
    const workbook = await readExcelFile(filePath, options);
    
    // Get sheet
    const sheet = sheetName 
      ? workbook.Sheets[sheetName]
      : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new ValidationError(`Sheet '${sheetName}' not found in Excel file`);
    }
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, {
      header: options.header,
      range: options.range,
      raw: options.raw !== false,
      defval: options.defaultValue || null,
      ...options
    });
    
    return data;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new AppError(`Failed to parse Excel sheet: ${error.message}`);
  }
}

/**
 * Read PDF content
 */
export async function readPDFContent(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const dataBuffer = await fs.readFile(absolutePath);
    const data = await PDFParse(dataBuffer);
    
    return {
      text: data.text,
      numpages: data.numpages,
      info: data.info,
      metadata: data.metadata
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`PDF file not found: ${filePath}`);
    }
    throw new AppError(`Failed to read PDF: ${error.message}`);
  }
}

/**
 * List files in directory with filtering
 */
export async function listFiles(dirPath, options = {}) {
  try {
    const absolutePath = path.resolve(dirPath);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    
    let files = entries
      .filter(entry => entry.isFile())
      .map(entry => ({
        name: entry.name,
        path: path.join(absolutePath, entry.name)
      }));
    
    // Apply extension filter
    if (options.extension) {
      const extensions = Array.isArray(options.extension) 
        ? options.extension 
        : [options.extension];
      files = files.filter(file => 
        extensions.some(ext => file.name.endsWith(ext))
      );
    }
    
    // Apply pattern filter
    if (options.pattern) {
      const pattern = new RegExp(options.pattern);
      files = files.filter(file => pattern.test(file.name));
    }
    
    return files;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`Directory not found: ${dirPath}`);
    }
    throw new AppError(`Failed to list files: ${error.message}`);
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file statistics
 */
export async function getFileStats(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const stats = await fs.stat(absolutePath);
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`File not found: ${filePath}`);
    }
    throw new AppError(`Failed to get file stats: ${error.message}`);
  }
}

/**
 * Copy file
 */
export async function copyFile(source, destination) {
  try {
    const sourcePath = path.resolve(source);
    const destPath = path.resolve(destination);
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await ensureDirectoryExists(destDir);
    
    await fs.copyFile(sourcePath, destPath);
    logger.info(`File copied from ${source} to ${destination}`);
    return destPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`Source file not found: ${source}`);
    }
    throw new AppError(`Failed to copy file: ${error.message}`);
  }
}

/**
 * Move file
 */
export async function moveFile(source, destination) {
  try {
    const sourcePath = path.resolve(source);
    const destPath = path.resolve(destination);
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await ensureDirectoryExists(destDir);
    
    await fs.rename(sourcePath, destPath);
    logger.info(`File moved from ${source} to ${destination}`);
    return destPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ValidationError(`Source file not found: ${source}`);
    }
    throw new AppError(`Failed to move file: ${error.message}`);
  }
}

/**
 * Delete file
 */
export async function deleteFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    await fs.unlink(absolutePath);
    logger.info(`File deleted: ${filePath}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false; // File doesn't exist, consider it deleted
    }
    throw new AppError(`Failed to delete file: ${error.message}`);
  }
}

export default {
  readJSONConfig,
  writeJSONData,
  ensureDirectoryExists,
  parseCSVFile,
  writeCSVData,
  readExcelFile,
  parseExcelSheet,
  readPDFContent,
  listFiles,
  fileExists,
  getFileStats,
  copyFile,
  moveFile,
  deleteFile
};