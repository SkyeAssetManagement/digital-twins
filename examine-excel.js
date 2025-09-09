import XLSX from 'xlsx';

const filePath = './data/datasets/mums/Detail_Parents Survey.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    console.log('=== EXCEL STRUCTURE ANALYSIS ===');
    console.log(`File: ${filePath}`);
    console.log(`Sheet: ${sheetName}`);
    console.log(`Range: ${sheet['!ref']}`);
    console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);
    console.log('');
    
    // Extract first 5 rows
    for (let row = 0; row <= Math.min(4, range.e.r); row++) {
        const rowData = [];
        for (let col = 0; col <= Math.min(15, range.e.c); col++) { // First 15 columns
            const cellRef = XLSX.utils.encode_cell({r: row, c: col});
            const cell = sheet[cellRef];
            rowData.push(cell ? cell.v : null);
        }
        console.log(`Row ${row + 1}:`, rowData);
    }
    
    console.log('\n=== ANALYSIS COMPLETE ===');
    
} catch (error) {
    console.error('Error reading Excel file:', error);
}