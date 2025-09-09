/**
 * Excel File Inspector
 * Tool to examine Excel structure and identify header issues
 */

import XLSX from 'xlsx';
import path from 'path';

export async function inspectExcelFile(filePath) {
    try {
        // Read the workbook
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const sheet = workbook.Sheets[sheetName];
        
        // Get the range of the sheet
        const range = XLSX.utils.decode_range(sheet['!ref']);
        
        console.log('=== EXCEL FILE INSPECTION ===');
        console.log(`File: ${filePath}`);
        console.log(`Sheet: ${sheetName}`);
        console.log(`Range: ${sheet['!ref']}`);
        console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);
        console.log('');
        
        // Extract first 5 rows to understand structure
        const firstRows = [];
        for (let row = 0; row <= Math.min(4, range.e.r); row++) {
            const rowData = [];
            for (let col = 0; col <= range.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({r: row, c: col});
                const cell = sheet[cellRef];
                rowData.push(cell ? cell.v : null);
            }
            firstRows.push(rowData);
        }
        
        console.log('=== FIRST 5 ROWS ===');
        firstRows.forEach((row, idx) => {
            console.log(`Row ${idx + 1}:`, row.slice(0, 10)); // First 10 columns only
        });
        
        return {
            sheetName,
            range,
            firstRows,
            totalRows: range.e.r + 1,
            totalColumns: range.e.c + 1
        };
        
    } catch (error) {
        console.error('Error inspecting Excel file:', error);
        return null;
    }
}

// Test with the mums dataset
if (import.meta.url === `file://${process.argv[1]}`) {
    const filePath = './data/datasets/mums/Detail_Parents Survey.xlsx';
    inspectExcelFile(filePath);
}