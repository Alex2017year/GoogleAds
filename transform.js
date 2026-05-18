const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'data.xlsx');
const GOOGLE_ADS_INPUT_FILE = path.join(__dirname, 'campaign-adgrops-adsets.xlsx');
const OUTPUT_DIR = path.join(__dirname, 'public', 'assets');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function padDatePart(value) {
    return String(value).padStart(2, '0');
}

function normalizeDateValue(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (typeof value === 'number') {
        const parsedCode = XLSX.SSF.parse_date_code(value);
        if (parsedCode) {
            return [
                parsedCode.y,
                padDatePart(parsedCode.m),
                padDatePart(parsedCode.d)
            ].join('-');
        }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return [
            value.getFullYear(),
            padDatePart(value.getMonth() + 1),
            padDatePart(value.getDate())
        ].join('-');
    }

    const text = String(value).trim();
    const slashMatch = text.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
    if (slashMatch) {
        let first = Number(slashMatch[1]);
        const second = Number(slashMatch[2]);
        let third = Number(slashMatch[3]);
        let year = first;
        let month = second;
        let day = third;

        if (slashMatch[1].length !== 4) {
            year = third;
            month = first;
            day = second;
        }

        if (year < 100) {
            year += 2000;
        }

        return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        return [
            parsed.getFullYear(),
            padDatePart(parsed.getMonth() + 1),
            padDatePart(parsed.getDate())
        ].join('-');
    }

    return text;
}

function convertByType(value, type, key = '') {
    if (String(key).toLowerCase() === 'date') {
        return normalizeDateValue(value);
    }

    if (value === null || value === undefined || value === '') {
        if (type === 'int' || type === 'integer') {
            return 0;
        } else if (type === 'float' || type === 'double') {
            return 0.0;
        } else if (type === 'bool' || type === 'boolean') {
            return false;
        } else if (type === 'string') {
            return '';
        }
        return null;
    }

    switch (type.toLowerCase()) {
        case 'int':
        case 'integer':
            return parseInt(value, 10);
        case 'float':
        case 'double':
            return parseFloat(value);
        case 'bool':
        case 'boolean':
            const lowerValue = String(value).toLowerCase();
            return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
        case 'string':
        default:
            return String(value);
    }
}

async function processExcelFile(filePath) {
    console.log(`Processing file: ${filePath}`);

    try {
        const workbook = XLSX.readFile(filePath, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        if (jsonData.length < 4) {
            console.error(`File ${filePath} doesn't have enough rows for conversion.`);
            return;
        }

        const labels = jsonData[1];
        const keys = jsonData[2];
        const types = jsonData[3];
        const dataRows = jsonData.slice(4);

        const columns = [];
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] && !keys[i].startsWith('//')) {
                columns.push({
                    width: 100,
                    key: keys[i],
                    label: labels[i] || keys[i]
                });
            }
        }

        const columnsPath = path.join(OUTPUT_DIR, 'columns.json');
        fs.writeFileSync(columnsPath, JSON.stringify(columns, null, 2), 'utf8');
        console.log(`Successfully created ${columnsPath}`);

        const tableData = [];
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const obj = {};

            if (!row || row.every(cell => cell === undefined || cell === null || cell === '')) {
                continue;
            }

            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                if (key && !key.startsWith('//')) {
                    const value = row[j];
                    const type = types[j] || 'string';
                    obj[key] = convertByType(value, type, key);
                }
            }

            if (Object.keys(obj).length > 0) {
                tableData.push(obj);
            }
        }

        const tableDataPath = path.join(OUTPUT_DIR, 'tableData.json');
        fs.writeFileSync(tableDataPath, JSON.stringify(tableData, null, 2), 'utf8');
        console.log(`Successfully created ${tableDataPath}`);

    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
    }
}

function cleanText(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }

    const text = String(value).trim();
    if (!text) {
        return fallback;
    }

    return text;
}

function readNumber(value) {
    const text = cleanText(value);
    if (!text || text === '--' || text === '—' || text === '。。。') {
        return 0;
    }

    const normalized = text
        .replace(/,/g, '')
        .replace(/\$/g, '')
        .replace(/%/g, '')
        .replace(/\/day/g, '')
        .replace(/[^\d.-]/g, '');

    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : 0;
}

function normalizeAccount(value, index) {
    const accounts = [
        '921-239-0750',
        '382-941-0056',
        '617-520-8394',
        '105-772-4613',
        '849-316-5582',
        '294-087-1129',
        '503-648-9271',
        '771-403-2285',
        '426-159-6740',
        '938-251-7064'
    ];
    const text = cleanText(value);

    if (!text || text === '--' || text.includes('上面') || text.includes('。。。')) {
        return accounts[index % accounts.length];
    }

    return text;
}

function normalizeCampaignStatus(value) {
    const text = cleanText(value, 'Enabled');
    if (text === 'Paused' || text === 'Removed' || text.startsWith('Total:')) {
        return text;
    }
    return 'Enabled';
}

function normalizeStatus(value, campaignStatus) {
    const text = cleanText(value);
    if (text && text !== '。。。') {
        return text;
    }
    return campaignStatus === 'Enabled' ? 'Eligible' : campaignStatus;
}

function objectRowsFromSheet(workbook, sheetName) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        return [];
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
    if (rows.length < 4) {
        return [];
    }

    const headers = rows[3];
    return rows.slice(4)
        .filter(row => row && row.some(cell => cleanText(cell)))
        .map((row, rowIndex) => {
            const record = {};
            headers.forEach((header, columnIndex) => {
                if (header) {
                    record[header] = row[columnIndex];
                }
            });
            record.__rowIndex = rowIndex;
            return record;
        });
}

function normalizeCampaignRow(row, index) {
    const campaignStatus = normalizeCampaignStatus(row['Campaign status']);
    const campaignName = cleanText(row.Campaign, `Campaign ${index + 1}`);
    const status = normalizeStatus(row.Status, campaignStatus);
    const installs = readNumber(row.Installs);
    const inAppActions = readNumber(row['In-app actions']);
    const conversions = readNumber(row.Conversions) || installs + inAppActions;
    const cost = readNumber(row.Cost);

    return {
        id: `campaign-${index + 1}`,
        campaignStatus,
        campaign: campaignName,
        budget: cleanText(row.Budget, '$10.00/day'),
        status,
        optimizationScore: cleanText(row['Optimization score'], '--'),
        account: normalizeAccount(row.Account, index),
        campaignType: cleanText(row['Campaign type'], 'App'),
        costPerInstall: readNumber(row['Cost / Install']),
        costPerInAppAction: readNumber(row['Cost / In-app action']),
        viewThroughConv: readNumber(row['View-through conv.']),
        installs,
        inAppActions,
        participatedInAppActions: readNumber(row['Participated in-app actions']) || inAppActions,
        cost,
        costPerParticipatedInAppAction: readNumber(row['Cost / Participated in-app action']),
        convRate: readNumber(row['Conv. rate']),
        conversions,
        costPerConv: readNumber(row['Cost / conv.']),
        isTotal: campaignStatus.startsWith('Total:'),
        isRemoved: campaignStatus === 'Removed'
    };
}

function normalizeAdGroupTemplate(row) {
    return {
        id: 'adgroup-1',
        adGroupStatus: cleanText(row['Ad group status'], 'Enabled'),
        adGroup: cleanText(row['Ad group'], 'Ad group 1'),
        status: cleanText(row.Status, 'Not eligible'),
        targetCpa: cleanText(row['Target CPA'], '$20.00'),
        conversions: readNumber(row.Conversions),
        costPerConv: readNumber(row['Cost / conv.']),
        costPerInstall: readNumber(row['Cost / Install']),
        costPerInAppAction: readNumber(row['Cost / In-app action']),
        viewThroughConv: readNumber(row['View-through conv.']),
        brandInclusions: cleanText(row['Brand Inclusions'], '[]'),
        locationsOfInterest: cleanText(row['Locations of interest'], '[]'),
        installs: readNumber(row.Installs),
        inAppActions: readNumber(row['In-app actions']),
        participatedInAppActions: readNumber(row['Participated in-app actions']),
        cost: readNumber(row.Cost),
        costPerParticipatedInAppAction: readNumber(row['Cost / Participated in-app action']),
        convRate: readNumber(row['Conv. rate'])
    };
}

function buildAssetRows() {
    const imageShares = [0.14, 0.12, 0.1, 0.09, 0.08, 0.07, 0.06, 0.055, 0.045, 0.04];
    const textAssets = [
        { id: 'headline-1', asset: 'Play chess with an AI', assetType: 'Headline', share: 0.09 },
        { id: 'headline-2', asset: 'The best chess game', assetType: 'Headline', share: 0.075 },
        { id: 'headline-3', asset: 'Challenge the AI and become a king of chess', assetType: 'Headline', share: 0.065 },
        { id: 'description-1', asset: 'Improve your chess skills', assetType: 'Description', share: 0.06 },
        { id: 'description-2', asset: 'Become a chess legend', assetType: 'Description', share: 0.05 },
        { id: 'description-3', asset: 'Play chess with computer', assetType: 'Description', share: 0.045 }
    ];

    const imageAssets = imageShares.map((share, index) => {
        const imageNumber = String(index + 1).padStart(2, '0');
        return {
            id: `image-${imageNumber}`,
            asset: `1080 x 1080`,
            assetType: 'Image',
            image: `/assets/ad-assets/asset-${imageNumber}.jpg`,
            source: `Free stock image - 2026-05-09 17:50:13.930 (${index + 1})`,
            dimensions: '1080 x 1080',
            orientation: 'Square',
            aspectRatio: '1:1',
            assetId: String(3590627600 + index),
            share
        };
    });

    return [...imageAssets, ...textAssets].map(asset => ({
        ...asset,
        status: 'Eligible',
        performance: 'Pending',
        clicks: 0,
        ctr: 0,
        impressions: 0,
        cost: 0,
        installs: 0,
        costPerInstall: 0,
        inAppActions: 0,
        costPerInAppAction: 0
    }));
}

async function processGoogleAdsWorkbook(filePath = INPUT_FILE) {
    if (!fs.existsSync(filePath)) {
        console.error(`Google Ads input file not found: ${filePath}`);
        return;
    }

    try {
        const workbook = XLSX.readFile(filePath, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        if (jsonData.length < 4) {
            console.error(`File ${filePath} doesn't have enough rows for conversion.`);
            return;
        }

        const labels = jsonData[1];
        const keys = jsonData[2];
        const types = jsonData[3];
        const dataRows = jsonData.slice(4);

        const columns = [];
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] && !keys[i].startsWith('//')) {
                columns.push({
                    width: 100,
                    key: keys[i],
                    label: labels[i] || keys[i]
                });
            }
        }

        const columnsPath = path.join(OUTPUT_DIR, 'columns.json');
        fs.writeFileSync(columnsPath, JSON.stringify(columns, null, 2), 'utf8');

        const tableData = [];
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const obj = {};

            if (!row || row.every(cell => cell === undefined || cell === null || cell === '')) {
                continue;
            }

            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                if (key && !key.startsWith('//')) {
                    const value = row[j];
                    const type = types[j] || 'string';
                    obj[key] = convertByType(value, type, key);
                }
            }

            if (Object.keys(obj).length > 0) {
                tableData.push(obj);
            }
        }

        const tableDataPath = path.join(OUTPUT_DIR, 'tableData.json');
        fs.writeFileSync(tableDataPath, JSON.stringify(tableData, null, 2), 'utf8');
        console.log(`Successfully created ${tableDataPath}`);
    } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
    }
}

async function main() {
    console.log('Starting Excel to JSON conversion...');
    console.log(`Input file: ${INPUT_FILE}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`);
        return;
    }

    await processExcelFile(INPUT_FILE);
    console.log('Conversion completed!');
}

async function googleAdsMain() {
    console.log('Starting Google Ads workbook conversion...');
    console.log(`Input file: ${INPUT_FILE}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);

    await processGoogleAdsWorkbook(INPUT_FILE);
    console.log('Google Ads conversion completed!');
}

// 导出函数，以便在其他文件中调用
module.exports = {
    processExcelFile,
    processGoogleAdsWorkbook,
    googleAdsMain,
    main
};
