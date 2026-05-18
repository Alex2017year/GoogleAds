const { createApp } = Vue;

const params = new URLSearchParams(window.location.search);
const CAMPAIGN_STATUS_STORAGE_KEY = 'googleAdsCampaignStatuses';
const ASSET_RANDOM_CACHE_KEY = 'googleAdsAssetRandom_';
const DATE_FILTER_STORAGE_KEY = 'googleAdsDateFilter';
const DEFAULT_DATE_FILTER = {
    selectedDateOption: 'custom',
    appliedDateOption: 'custom',
    startDate: '2026-04-11',
    endDate: '2026-05-08'
};

function readCampaignStatusOverrides() {
    try {
        const saved = JSON.parse(localStorage.getItem(CAMPAIGN_STATUS_STORAGE_KEY) || '{}');
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
        return {};
    }
}

function getInitialPageMode() {
    if (window.GOOGLE_ADS_PAGE) {
        return window.GOOGLE_ADS_PAGE;
    }
    if (window.location.pathname.includes('/adassets')) return 'adassets';
    if (window.location.pathname.includes('/adgroups')) return 'adgroups';
    return 'campaigns';
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function parseStoredDate(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function readDateFilterState() {
    let saved = {};
    try {
        saved = JSON.parse(sessionStorage.getItem(DATE_FILTER_STORAGE_KEY) || '{}');
    } catch (error) {
        saved = {};
    }

    const startDate = parseStoredDate(saved.startDate) || parseStoredDate(DEFAULT_DATE_FILTER.startDate);
    const endDate = parseStoredDate(saved.endDate) || parseStoredDate(DEFAULT_DATE_FILTER.endDate);

    return {
        selectedDateOption: saved.selectedDateOption || DEFAULT_DATE_FILTER.selectedDateOption,
        appliedDateOption: saved.appliedDateOption || DEFAULT_DATE_FILTER.appliedDateOption,
        startDate,
        endDate
    };
}

createApp({
    data() {
        const initialDateFilter = readDateFilterState();
        return {
            pageMode: getInitialPageMode(),
            dropdown: '',
            campaignStatusOverrides: readCampaignStatusOverrides(),
            isNavCollapsed: localStorage.getItem('googleAdsNavCollapsed') === 'true',
            selectedCampaignId: params.get('campaignId') || '',
            selectedAdGroupId: params.get('adGroupId') || 'adgroup-1',
            showDatePicker: false,
            selectedDateOption: initialDateFilter.selectedDateOption,
            appliedDateOption: initialDateFilter.appliedDateOption,
            compareEnabled: false,
            startDate: initialDateFilter.startDate,
            endDate: initialDateFilter.endDate,
            draftStartDate: null,
            draftEndDate: null,
            calendarMonth: initialDateFilter.startDate
                ? new Date(initialDateFilter.startDate.getFullYear(), initialDateFilter.startDate.getMonth(), 1)
                : new Date(2026, 3, 1),
            selectingStartDate: true,
            previewModal: null,
            isContextBarHidden: false,
            ads_isCampaignOpen: true,
            ads_isInsightsReportsOpen: true,
            ads_isAssetsOpen:false,
            isNotificationsOpen: false,
            tooltip: {
                visible: false,
                text: '',
                x: 0,
                y: 0
            },
            ads_currentTooltipTarget: null,
            ads_tooltipTimer: null,
            mouseX: 0,
            mouseY: 0,

            sidebarGroups: {
                insights: false,
                campaigns: true,
                assets: true
            },
            statusMenuOptions: [
                { state: 'Enabled', label: 'Enable' },
                { state: 'Paused', label: 'Pause' },
                { state: 'Removed', label: 'Remove' }
            ],
            account: {
                id: '1124-4-mcc',
                phone: '172-135-6148',
                email: 'nwq0822@gmail.com',
                name: 'reillymalvina309@gmail.com'
            },
            rawData: [],
            adAssetData: [],
            data: {
                dateRange: {
                    start: '2026-04-11',
                    end: '2026-05-08',
                    label: 'Apr 11 - May 8, 2026'
                },
                campaigns: [],
                adGroupTemplate: {
                    id: 'adgroup-1',
                    adGroup: 'Ad group 1',
                    targetCpa: '$20.00'
                },
                assets: [],
                assetSummary: {
                    headlines: '3/3',
                    descriptions: '3/3',
                    images: '10/10',
                    videos: '0/20'
                }
            }
        };
    },
    computed: {
        filteredRawData() {
            if (!this.startDate || !this.endDate) return this.rawData;

            const start = this.parseLocalDate(this.startDate);
            const end = this.parseLocalDate(this.endDate);
            if (!start || !end) return this.rawData;

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            return this.rawData.filter(row => {
                const rowDate = this.parseLocalDate(row.date);
                if (!rowDate) return false;
                return rowDate >= start && rowDate <= end;
            });
        },
        campaignRows() {
            return this.data.campaigns
                .filter(campaign => !campaign.isTotal && !campaign.isRemoved)
                .slice()
                .sort((left, right) => left.campaign.localeCompare(right.campaign, 'en', { numeric: true }));
        },
        adGroupRows() {
            const campaignName = this.selectedCampaignId || params.get('campaignId') || '';
            if (!campaignName || !this.rawData.length) return [];
            const filtered = this.filteredRawData.filter(row => row.campaign === campaignName);
            return this.mergeAdGroupsBy(filtered);
        },
        adGroupTotal() {
            return this.adGroupRows.reduce((acc, row) => {
                acc.Conversions += safeNumber(row.Conversions);
                acc.cost += safeNumber(row.cost);
                acc.installs += safeNumber(row.installs);
                acc.inAppActions += safeNumber(row.inAppActions);
                acc.impressions += safeNumber(row.impressions);
                acc.clicks += safeNumber(row.clicks);
                acc.ParticipatedInAppActions += safeNumber(row.ParticipatedInAppActions);
                acc.ViewThroughConv += safeNumber(row.ViewThroughConv);
                acc.CostPerConv = acc.Conversions ? acc.cost / acc.Conversions : 0;
                acc.costPerInstall = acc.installs ? acc.cost / acc.installs : 0;
                acc.costPerInAppActions = acc.inAppActions ? acc.cost / acc.inAppActions : 0;
                acc.CostPerParticipatedInAppAction = acc.ParticipatedInAppActions ? acc.cost / acc.ParticipatedInAppActions : 0;
                acc.ConvRate = acc.installs ? acc.Conversions / acc.installs : 0;
                return acc;
            }, { Conversions: 0, cost: 0, installs: 0, inAppActions: 0, impressions: 0, clicks: 0, ParticipatedInAppActions: 0, ViewThroughConv: 0, CostPerConv: 0, costPerInstall: 0, costPerInAppActions: 0, CostPerParticipatedInAppAction: 0, ConvRate: 0 });
        },
        selectedCampaign() {
            if (!this.campaignRows.length) return null;
            return this.campaignRows.find(campaign => campaign.campaign === this.selectedCampaignId) || this.campaignRows[0];
        },
        adGroup() {
            return this.data.adGroupTemplate;
        },
        campaignSelectorLabel() {
            return this.pageMode === 'campaigns' ? `Campaigns (${this.campaignRows.length})` : 'Campaign';
        },
        campaignQuery() {
            return this.selectedCampaign ? `campaignId=${encodeURIComponent(this.selectedCampaign.campaign)}` : '';
        },
        adGroupsHref() {
            return this.campaignQuery ? `/aw/adgroups?${this.campaignQuery}` : '/aw/adgroups';
        },
        adAssetsHref() {
            const campaign = this.campaignQuery ? `${this.campaignQuery}&` : '';
            return `/aw/adassets?${campaign}adGroupId=${encodeURIComponent(this.selectedAdGroupId)}`;
        },
        pageTitle() {
            if (this.pageMode === 'adassets') return 'Ad assets';
            if (this.pageMode === 'adgroups') return 'Ad groups';
            return 'Campaigns';
        },
        totals() {
            const result = this.campaignRows.reduce((acc, campaign) => {
                acc.cost += safeNumber(campaign.cost);
                acc.installs += safeNumber(campaign.installs);
                acc.inAppActions += safeNumber(campaign.inAppActions);
                acc.impressions += safeNumber(campaign.impressions);
                acc.clicks += safeNumber(campaign.clicks);
                acc.conversions += safeNumber(campaign.Conversions || campaign.conversions);
                acc.viewThroughConv += safeNumber(campaign.ViewThroughConv || campaign.viewThroughConv);
                return acc;
            }, {
                cost: 0,
                installs: 0,
                inAppActions: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                viewThroughConv: 0,
                ctr: 0
            });
            result.ctr = result.impressions ? (result.clicks / result.impressions) * 100 : 0;
            return result;
        },
        selectedCost() {
            return this.selectedCampaign ? safeNumber(this.selectedCampaign.cost) : 0;
        },
        selectedConversions() {
            return this.selectedCampaign ? safeNumber(this.selectedCampaign.Conversions || this.selectedCampaign.conversions) : 0;
        },
        selectedCostPerInstall() {
            return this.selectedCampaign ? safeNumber(this.selectedCampaign.costPerInstall) : 0;
        },
        selectedCostPerInAppAction() {
            return this.selectedCampaign ? safeNumber(this.selectedCampaign.costPerInAppAction) : 0;
        },
        selectedCostPerConv() {
            if (!this.selectedConversions) return 0;
            return this.selectedCost / this.selectedConversions;
        },
        metricCards() {
            if (this.pageMode === 'adgroups') {
                return [
                    { label: 'Cost', value: this.money(this.selectedCost), delta: `up ${this.money(this.selectedCost)}` },
                    { label: 'Conversions', value: this.fixed(this.selectedConversions, 2), delta: `up ${this.fixed(this.selectedConversions, 2)}` }
                ];
            }

            return [
                { label: 'Conversions', value: this.fixed(this.totals.conversions, 2), delta: `up ${this.fixed(this.totals.conversions, 2)}` },
                { label: 'Impr.', value: '0', delta: 'up 0' },
                { label: 'Cost', value: this.money(this.totals.cost), delta: `up ${this.money(this.totals.cost)}` },
                { label: 'Conv. value', value: '0.00', delta: 'up 0.00' }
            ];
        },
        metricActions() {
            return [
                { icon: 'add_chart', label: 'Metrics' },
                { icon: 'tune', label: 'Adjust', badge: this.pageMode === 'adgroups' ? '2' : '1' },
                { icon: 'file_download', label: 'Download' },
                { icon: 'fullscreen', label: 'Expand' }
            ];
        },
        tableTools() {
            if (this.pageMode === 'adassets') {
                return [
                    { icon: 'segment', label: 'Segment' },
                    { icon: 'view_column', label: 'Columns' },
                    { icon: 'file_download', label: 'Download' },
                    { icon: 'fullscreen', label: 'Expand' }
                ];
            }
            return [
                { icon: 'search', label: 'Search' },
                { icon: 'segment', label: 'Segment' },
                { icon: 'view_column', label: 'Columns' },
                { icon: 'insert_chart', label: 'Reports' },
                { icon: 'file_download', label: 'Download' },
                { icon: 'fullscreen', label: 'Expand' },
                { icon: 'more_vert', label: 'More' }
            ];
        },
        selectedCampaignStatusClass() {
            if (!this.selectedCampaign) return '';
            return this.statusDotClass(this.getStatusFromRow(this.selectedCampaign));
        },
        selectedCampaignStateLabel() {
            if (!this.selectedCampaign) return '';
            const status = this.getStatusFromRow(this.selectedCampaign);
            return (status === 'Enabled' || status === 'Eligible') ? 'Enabled' : 'Paused';
        },
        selectedCampaignStatusText() {
            if (!this.selectedCampaign) return '';
            return this.selectedCampaign.Status || this.selectedCampaign.status || this.selectedCampaign.campaignStatus || '';
        },
        isSelectedCampaignProblem() {
            const text = this.selectedCampaignStatusText;
            if (!text) return false;
            return text.toLowerCase().includes('not') || text.toLowerCase().includes('paused') || text.toLowerCase().includes('disapproved') || text.toLowerCase().includes('limited');
        },
        assetRows() {
            if (!this.adAssetData.length) return [];
            const src = this.adGroupTotal;
            if (!src.clicks && !src.cost) return [];

            const campaignKey = params.get('campaignId') || 'default';
            let cached = null;
            try { cached = JSON.parse(sessionStorage.getItem(ASSET_RANDOM_CACHE_KEY + campaignKey)); } catch(e) {}

            // 验证缓存完整性：图片需要 randomNum + 5个字段系数 + 10个权重 + 10行独立系数，文本需要 6 行每行 5 个系数
            if (!cached ||
                !cached.imageRandom || !cached.imageFieldCoefs || cached.imageFieldCoefs.length !== 5 ||
                !cached.imageWeights || cached.imageWeights.length !== 10 ||
                !cached.imageRowCoefs || cached.imageRowCoefs.length !== 10 || cached.imageRowCoefs.some(r => r.length !== 5) ||
                !cached.textRowRandoms || cached.textRowRandoms.length !== 6 ||
                !cached.textRowCoefs || cached.textRowCoefs.length !== 6 || cached.textRowCoefs.some(r => r.length !== 5)) {

                // ====== 图片随机值 ======
                const imageRandom = 0.6 + Math.random() * 0.8;
                // 5 个字段各自的浮动系数（基于 randomNum ±0.9），用于算总计
                const imageFieldCoefs = Array.from({ length: 5 }, () => imageRandom + (Math.random() * 2 - 1) * 0.1);
                // 每张图片独立的5字段系数（±0.6浮动），使每张图的CTR等衍生指标差距更大
                const imageRowCoefs = Array.from({ length: 10 }, () =>
                    Array.from({ length: 5 }, () => imageRandom + (Math.random() * 2 - 1) * 0.6)
                );
                // 10 个权重：用幂律分布，大者越大小者越小，再归一化到和为1
                const rawWeights = Array.from({ length: 10 }, () => Math.pow(Math.random(), 2.5));
                const weightSum = rawWeights.reduce((a, b) => a + b, 0);
                const imageWeights = rawWeights.map(w => w / weightSum);

                // ====== 文本行随机值（headline+description 共6行）======
                const textRowRandoms = Array.from({ length: 6 }, () => 0.2 + Math.random() * 0.5);
                // 每行 5 个字段各自浮动系数（基于该行的 randomNumX ±0.5），拉大CTR差距
                const textRowCoefs = textRowRandoms.map(rx =>
                    Array.from({ length: 5 }, () => rx * (0.2 + Math.random() * 0.6))
                );

                cached = { imageRandom, imageFieldCoefs, imageRowCoefs, imageWeights, textRowRandoms, textRowCoefs };
                sessionStorage.setItem(ASSET_RANDOM_CACHE_KEY + campaignKey, JSON.stringify(cached));
            }

            const ifc = cached.imageFieldCoefs; // [clicksCoef, imprCoef, costCoef, installsCoef, inAppActionsCoef]

            // 图片总计 = 聚合值 × 各自保存的浮动系数
            const imgTotalClicks = src.clicks * ifc[0];
            const imgTotalImpr = src.impressions * ifc[1];
            const imgTotalCost = src.cost * ifc[2];
            const imgTotalInstalls = src.installs * ifc[3];
            const imgTotalInAppActions = src.inAppActions * ifc[4];

            const images = [];
            const headlines = [];
            const descriptions = [];
            let imgIdx = 0;
            let textIdx = 0;

            for (const asset of this.adAssetData) {
                if (asset.assetType === 'Image') {
                    const w = cached.imageWeights[imgIdx];
                    const rc = cached.imageRowCoefs[imgIdx]; // 该行独立的5字段系数
                    images.push({
                        ...asset,
                        clicks: Math.max(1, Math.round(imgTotalClicks * rc[0] * w)),
                        impressions: Math.max(1, Math.round(imgTotalImpr * rc[1] * w)),
                        cost: +(Math.max(0.01, imgTotalCost * rc[2] * w)).toFixed(2),
                        installs: Math.max(1, Math.round(imgTotalInstalls * rc[3] * w)),
                        inAppActions: Math.max(1, Math.round(imgTotalInAppActions * rc[4] * w)),
                        ctr: 0, costPerInstall: 0, costPerInAppAction: 0
                    });
                    imgIdx++;
                } else if (asset.assetType === 'Headline') {
                    const rx = cached.textRowRandoms[textIdx];
                    const rc = cached.textRowCoefs[textIdx]; // [clicksCoef, imprCoef, costCoef, installsCoef, inAppActionsCoef]
                    headlines.push({
                        ...asset,
                        clicks: Math.max(1, Math.round(src.clicks * rc[0])),
                        impressions: Math.max(1, Math.round(src.impressions * rc[1])),
                        cost: +(Math.max(0.01, src.cost * rc[2])).toFixed(2),
                        installs: Math.max(1, Math.round(src.installs * rc[3])),
                        inAppActions: Math.max(1, Math.round(src.inAppActions * rc[4])),
                        ctr: 0, costPerInstall: 0, costPerInAppAction: 0
                    });
                    textIdx++;
                } else {
                    const rx = cached.textRowRandoms[textIdx];
                    const rc = cached.textRowCoefs[textIdx];
                    descriptions.push({
                        ...asset,
                        clicks: Math.max(1, Math.round(src.clicks * rc[0])),
                        impressions: Math.max(1, Math.round(src.impressions * rc[1])),
                        cost: +(Math.max(0.01, src.cost * rc[2])).toFixed(2),
                        installs: Math.max(1, Math.round(src.installs * rc[3])),
                        inAppActions: Math.max(1, Math.round(src.inAppActions * rc[4])),
                        ctr: 0, costPerInstall: 0, costPerInAppAction: 0
                    });
                    textIdx++;
                }
            }

            // 计算衍生字段
            const all = [...images, ...headlines, ...descriptions];
            for (const row of all) {
                row.ctr = row.impressions ? (row.clicks / row.impressions) * 100 : 0;
                row.costPerInstall = row.installs ? row.cost / row.installs : 0;
                row.costPerInAppAction = row.inAppActions ? row.cost / row.inAppActions : 0;
            }

            return all;
        },
        paginationText() {
            if (this.pageMode === 'adassets') {
                return `1 - ${this.assetRows.length} of ${this.assetRows.length}`;
            }
            if (this.pageMode === 'adgroups') {
                return `1 - ${this.adGroupRows.length} of ${this.adGroupRows.length}`;
            }
            return `1 - ${this.campaignRows.length} of ${this.campaignRows.length}`;
        },
        calendarMonths() {
            const months = [];
            const baseDate = this.calendarMonth;
            for (let i = -6; i < 6; i++) {
                const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
                const calendarData = this.getCalendarWeeks(targetDate);
                months.push({
                    date: targetDate,
                    monthYear: targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase(),
                    weeks: calendarData.weeks,
                    firstWeekCurrentMonthDays: calendarData.firstWeekCurrentMonthDays,
                    showTitleInline: calendarData.firstWeekCurrentMonthDays < 4
                });
            }
            return months;
        },
        calendarMonthYear() {
            return this.calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
        },
        formattedStartDate() {
            if (!this.startDate) return '';
            return this.formatDate(this.startDate);
        },
        formattedEndDate() {
            if (!this.endDate) return '';
            return this.formatDate(this.endDate);
        },
        formattedDraftStartDate() {
            if (!this.draftStartDate) return '';
            return this.formatDate(this.draftStartDate);
        },
        formattedDraftEndDate() {
            if (!this.draftEndDate) return '';
            return this.formatDate(this.draftEndDate);
        },
        dateRangeLabel() {
            if (!this.formattedStartDate || !this.formattedEndDate) return '';
            return this.formattedStartDate === this.formattedEndDate
                ? this.formattedStartDate
                : `${this.formattedStartDate} - ${this.formattedEndDate}`;
        },
        dropdownStyle() {
            if (!this.showDatePicker || !this.$refs.dateSelectRef) return {};
            const rect = this.$refs.dateSelectRef.getBoundingClientRect();
            const pickerWidth = 508;
            const left = Math.max(16, Math.min(rect.left, window.innerWidth - pickerWidth - 16));
            return {
                position: 'fixed',
                top: `${rect.bottom + 8}px`,
                left: `${left}px`,
                zIndex: '10000'
            };
        }
    },
    methods: {
        async reloadData() {
            await this.loadData();
        },
        async loadData() {
            try {
                const response = await fetch('/assets/tableData.json', { cache: 'no-store' });
                const rawData = await response.json();
                this.rawData = rawData;
                this.refreshCampaignData();
                if (!this.selectedCampaignId && this.pageMode !== 'campaigns' && this.campaignRows.length) {
                    this.selectedCampaignId = this.campaignRows[0].campaign;
                }
                // 加载 adassets 资源
                await this.loadAdAssets();
            } catch (error) {
                console.error('Unable to load Google Ads data', error);
            }
        },
        async loadAdAssets() {
            try {
                const res = await fetch('/api/adassets/plan1', { cache: 'no-store' });
                const json = await res.json();
                this.adAssetData = json.assets || [];
            } catch (error) {
                console.error('Unable to load ad assets', error);
            }
        },
        refreshCampaignData() {
            this.data = {
                ...this.data,
                dateRange: {
                    start: this.formatIsoDate(this.startDate),
                    end: this.formatIsoDate(this.endDate),
                    label: this.dateRangeLabel
                },
                campaigns: this.mergeCampaignsBy(this.filteredRawData)
            };
            this.applyCampaignStatusOverrides();
        },
        parseLocalDate(value) {
            if (!value) return null;

            if (value instanceof Date) {
                if (Number.isNaN(value.getTime())) return null;
                return new Date(value.getFullYear(), value.getMonth(), value.getDate());
            }

            const text = String(value).trim();
            const dateOnlyMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (dateOnlyMatch) {
                return new Date(
                    Number(dateOnlyMatch[1]),
                    Number(dateOnlyMatch[2]) - 1,
                    Number(dateOnlyMatch[3])
                );
            }

            const parsed = new Date(text);
            if (Number.isNaN(parsed.getTime())) return null;
            return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        },
        formatDate(date) {
            const d = this.parseLocalDate(date);
            if (!d) return '';
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        },
        formatIsoDate(date) {
            const d = this.parseLocalDate(date);
            if (!d) return '';
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}-${month}-${day}`;
        },
        getDateOptionLabel(option) {
            const labels = {
                today: 'Today',
                yesterday: 'Yesterday',
                thisWeekSunSat: 'This week (Sun - Today)',
                thisWeekMonSun: 'This week (Mon - Today)',
                last7Days: 'Last 7 days (up to yesterday)',
                lastWeekSunSat: 'Last week (Sun - Sat)',
                lastWeekMonSun: 'Last week (Mon - Sun)',
                lastBusinessWeek: 'Last business week (Mon - Fri)',
                last14Days: 'Last 14 days (up to yesterday)',
                thisMonth: 'This month',
                last30Days: 'Last 30 days',
                lastMonth: 'Last month',
                allTime: 'All time',
                custom: 'Custom'
            };
            return labels[option] || 'Custom';
        },
        getCalendarWeeks(targetDate) {
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDay = firstDay.getDay();
            const weeks = [];
            let currentWeek = [];
            let firstWeekCurrentMonthDays = 0;

            for (let i = 0; i < startDay; i++) {
                currentWeek.push({ date: new Date(year, month, -startDay + i + 1), isCurrentMonth: false });
            }

            for (let i = 1; i <= lastDay.getDate(); i++) {
                currentWeek.push({ date: new Date(year, month, i), isCurrentMonth: true });
                if (weeks.length === 0) firstWeekCurrentMonthDays++;
                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }

            if (currentWeek.length > 0) {
                for (let i = 1; currentWeek.length < 7; i++) {
                    currentWeek.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
                }
                weeks.push(currentWeek);
            }

            return { weeks, firstWeekCurrentMonthDays };
        },
        isSameDay(date1, date2) {
            const d1 = this.parseLocalDate(date1);
            const d2 = this.parseLocalDate(date2);
            if (!d1 || !d2) return false;
            return d1.getFullYear() === d2.getFullYear() &&
                d1.getMonth() === d2.getMonth() &&
                d1.getDate() === d2.getDate();
        },
        isInRange(date) {
            if (!this.draftStartDate || !this.draftEndDate) return false;
            const d = this.parseLocalDate(date);
            const start = this.parseLocalDate(this.draftStartDate);
            const end = this.parseLocalDate(this.draftEndDate);
            if (!d || !start || !end) return false;
            return d >= start && d <= end;
        },
        toggleDatePicker(event) {
            if (event) event.stopPropagation();
            if (this.showDatePicker) {
                this.cancelDateRange();
                return;
            }

            this.dropdown = '';
            this.showDatePicker = true;
            this.resetDraftDateRange();
            this.calendarMonth = this.draftStartDate ? new Date(this.draftStartDate) : new Date();
            this.$nextTick(() => this.scrollToSelectedDate());
        },
        scrollToSelectedDate() {
            if (!this.draftStartDate) return;
            const selectedDayElement = document.querySelector('.date-picker-dropdown .calendar-day.selected');
            if (selectedDayElement) {
                selectedDayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        handleClickOutside(event) {
            if (!this.showDatePicker) return;
            const datePickerEl = document.querySelector('.date-picker-dropdown');
            const dateSelectEl = this.$refs.dateSelectRef;
            if (datePickerEl && !datePickerEl.contains(event.target) &&
                dateSelectEl && !dateSelectEl.contains(event.target)) {
                this.cancelDateRange();
            }
        },
        selectDateOption(option) {
            this.selectedDateOption = option;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            switch (option) {
                case 'today':
                    this.draftStartDate = new Date(today);
                    this.draftEndDate = new Date(today);
                    break;
                case 'yesterday': {
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    this.draftStartDate = new Date(yesterday);
                    this.draftEndDate = new Date(yesterday);
                    break;
                }
                case 'thisWeekSunSat': {
                    const start = new Date(today);
                    start.setDate(start.getDate() - start.getDay());
                    this.draftStartDate = start;
                    this.draftEndDate = new Date(today);
                    break;
                }
                case 'thisWeekMonSun': {
                    const start = new Date(today);
                    const day = start.getDay();
                    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
                    this.draftStartDate = start;
                    this.draftEndDate = new Date(today);
                    break;
                }
                case 'last7Days': {
                    const start = new Date(today);
                    start.setDate(start.getDate() - 7);
                    const end = new Date(today);
                    end.setDate(end.getDate() - 1);
                    this.draftStartDate = start;
                    this.draftEndDate = end;
                    break;
                }
                case 'lastWeekSunSat': {
                    const start = new Date(today);
                    const diff = start.getDay() === 0 ? 7 : start.getDay();
                    start.setDate(start.getDate() - diff);
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    this.draftStartDate = start;
                    this.draftEndDate = end;
                    break;
                }
                case 'lastWeekMonSun': {
                    const start = new Date(today);
                    const day = start.getDay();
                    start.setDate(start.getDate() - (day === 1 ? 7 : (day === 0 ? 6 : day - 1)));
                    const end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    this.draftStartDate = start;
                    this.draftEndDate = end;
                    break;
                }
                case 'lastBusinessWeek': {
                    const start = new Date(today);
                    const day = start.getDay();
                    start.setDate(start.getDate() - (day === 1 ? 7 : (day === 0 ? 6 : day - 1)));
                    const end = new Date(start);
                    end.setDate(end.getDate() + 4);
                    this.draftStartDate = start;
                    this.draftEndDate = end;
                    break;
                }
                case 'last14Days': {
                    const start = new Date(today);
                    start.setDate(start.getDate() - 14);
                    const end = new Date(today);
                    end.setDate(end.getDate() - 1);
                    this.draftStartDate = start;
                    this.draftEndDate = end;
                    break;
                }
                case 'thisMonth':
                    this.draftStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    this.draftEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    break;
                case 'last30Days': {
                    const start = new Date(today);
                    start.setDate(start.getDate() - 29);
                    this.draftStartDate = start;
                    this.draftEndDate = new Date(today);
                    break;
                }
                case 'lastMonth':
                    this.draftStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    this.draftEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;
                case 'allTime':
                    this.draftStartDate = new Date(2000, 0, 1);
                    this.draftEndDate = new Date(today);
                    break;
                case 'custom':
                    if (!this.draftStartDate || !this.draftEndDate) {
                        this.resetDraftDateRange();
                    }
                    break;
            }

            if (this.draftStartDate) {
                this.calendarMonth = new Date(this.draftStartDate);
            }
            this.$nextTick(() => this.scrollToSelectedDate());
        },
        selectCalendarDate(date) {
            if (this.selectingStartDate) {
                this.draftStartDate = new Date(date);
                this.draftEndDate = null;
                this.selectingStartDate = false;
            } else {
                if (date < this.draftStartDate) {
                    this.draftEndDate = new Date(this.draftStartDate);
                    this.draftStartDate = new Date(date);
                } else {
                    this.draftEndDate = new Date(date);
                }
                this.selectingStartDate = true;
            }
            this.selectedDateOption = 'custom';
            this.calendarMonth = new Date(date);
        },
        selectStartDate() {
            this.selectingStartDate = true;
            this.selectedDateOption = 'custom';
        },
        selectEndDate() {
            this.selectingStartDate = false;
            this.selectedDateOption = 'custom';
        },
        navigateMonth(direction) {
            this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + direction, 1);
        },
        cloneDate(date) {
            const parsed = this.parseLocalDate(date);
            return parsed ? new Date(parsed) : null;
        },
        resetDraftDateRange() {
            this.selectedDateOption = this.appliedDateOption;
            this.draftStartDate = this.cloneDate(this.startDate);
            this.draftEndDate = this.cloneDate(this.endDate);
            this.selectingStartDate = true;
        },
        applyDateRange() {
            if (!this.draftStartDate || !this.draftEndDate) return;
            this.startDate = this.cloneDate(this.draftStartDate);
            this.endDate = this.cloneDate(this.draftEndDate);
            this.appliedDateOption = this.selectedDateOption;
            this.saveDateFilterState();
            this.refreshCampaignData();
            this.showDatePicker = false;
        },
        cancelDateRange() {
            this.resetDraftDateRange();
            this.showDatePicker = false;
        },
        applyQuickDateOption(option) {
            this.selectDateOption(option);
            this.applyDateRange();
        },
        shiftDateRange(direction) {
            const start = this.cloneDate(this.startDate);
            const end = this.cloneDate(this.endDate);
            if (!start || !end) return;
            const daySpan = Math.max(1, Math.round((end - start) / 86400000) + 1);
            start.setDate(start.getDate() + direction * daySpan);
            end.setDate(end.getDate() + direction * daySpan);
            this.startDate = start;
            this.endDate = end;
            this.appliedDateOption = 'custom';
            this.selectedDateOption = 'custom';
            this.saveDateFilterState();
            this.refreshCampaignData();
        },
        saveDateFilterState() {
            try {
                sessionStorage.setItem(DATE_FILTER_STORAGE_KEY, JSON.stringify({
                    selectedDateOption: this.selectedDateOption,
                    appliedDateOption: this.appliedDateOption,
                    startDate: this.formatIsoDate(this.startDate),
                    endDate: this.formatIsoDate(this.endDate)
                }));
            } catch (error) {
            }
        },
        toggleDropdown(name) {
            if (name === 'view' && this.pageMode !== 'campaigns') {
                window.location.href = '/aw/campaigns';
                return;
            }
            this.dropdown = this.dropdown === name ? '' : name;
        },
        toggleNavigation() {
            this.isNavCollapsed = !this.isNavCollapsed;
            localStorage.setItem('googleAdsNavCollapsed', String(this.isNavCollapsed));
        },
        isSidebarGroupOpen(groupName) {
            return Boolean(this.sidebarGroups[groupName]);
        },
        toggleSidebarGroup(groupName) {
            this.sidebarGroups = {
                ...this.sidebarGroups,
                [groupName]: !this.sidebarGroups[groupName]
            };
        },
        closeDropdown() {
            this.dropdown = '';
        },
        statusDropdownName(campaignId) {
            return `campaign-status-${campaignId}`;
        },
        toggleStatusMenu(campaignId) {
            const dropdownName = this.statusDropdownName(campaignId);
            this.dropdown = this.dropdown === dropdownName ? '' : dropdownName;
        },
        campaignStatusText(status) {
            return status === 'Enabled' ? 'Eligible' : status;
        },
        applyCampaignStatus(campaign, status) {
            campaign.campaignStatus = status;
            campaign.status = this.campaignStatusText(status);
            campaign.Status = this.campaignStatusText(status);
            campaign.isRemoved = status === 'Removed';
        },
        applyCampaignStatusOverrides() {
            if (!Array.isArray(this.data.campaigns)) return;
            this.data.campaigns.forEach(campaign => {
                const status = this.campaignStatusOverrides[campaign.campaign];
                if (status) {
                    this.applyCampaignStatus(campaign, status);
                }
            });
        },
        setCampaignStatus(campaign, status) {
            this.applyCampaignStatus(campaign, status);
            this.campaignStatusOverrides = {
                ...this.campaignStatusOverrides,
                [campaign.campaign]: status
            };
            localStorage.setItem(CAMPAIGN_STATUS_STORAGE_KEY, JSON.stringify(this.campaignStatusOverrides));
            this.dropdown = '';
        },
        campaignHref(id) {
            return `/aw/adgroups?campaignId=${encodeURIComponent(id)}`;
        },
        statusDotClass(status) {
            if (status === 'Enabled') return 'enabled';
            if (status === 'Removed') return 'removed';
            if (status === 'Eligible') return 'enabled';
            return 'paused';
        },
        getStatusFromRow(campaign) {
            return campaign.Status || campaign.status || campaign.campaignStatus || 'Eligible';
        },
        mergeCampaignsBy(rawData) {
            const campaignMap = new Map();

            for (const row of rawData) {
                const key = row.campaign;
                if (!campaignMap.has(key)) {
                    campaignMap.set(key, {
                        id: key,
                        campaign: key,
                        campaignId: row.campaignId,
                        Buget: row.Buget || 0,
                        Status: row.Status || 'Eligible',
                        OptimizationScore: row.OptimizationScore,
                        CampaignType: row.CampaignType || 'App',
                        costPerInstall: 0,
                        costPerInAppActions: 0,
                        costPerInAppAction: 0,
                        ViewThroughConv: 0,
                        impressions: 0,
                        clicks: 0,
                        installs: 0,
                        inAppActions: 0,
                        ParticipatedInAppActions: 0,
                        cost: 0,
                        CostPerParticipatedInAppAction: 0,
                        ConvRate: 0,
                        Conversions: 0,
                        CostPerConv: 0,
                        isTotal: false,
                        isRemoved: false
                    });
                }

                const merged = campaignMap.get(key);
                merged.impressions += safeNumber(row.impressions);
                merged.clicks += safeNumber(row.clicks);
                merged.installs += safeNumber(row.installs);
                merged.inAppActions += safeNumber(row.inAppActions);
                merged.ParticipatedInAppActions += safeNumber(row.ParticipatedInAppActions || row.ParticlpatedInAppActions);
                merged.cost += safeNumber(row.cost);
                merged.ViewThroughConv += safeNumber(row.ViewThroughConv || row.viewThroughConv);
                merged.Conversions += safeNumber(row.Conversions);

                // 汇总后计算衍生字段
                merged.costPerInstall = merged.installs ? merged.cost / merged.installs : 0;
                merged.costPerInAppActions = merged.inAppActions ? merged.cost / merged.inAppActions : 0;
                merged.costPerInAppAction = merged.costPerInAppActions;
                merged.CostPerParticipatedInAppAction = merged.ParticipatedInAppActions ? merged.cost / merged.ParticipatedInAppActions : 0;
                merged.ConvRate = merged.installs ? merged.Conversions / merged.installs : 0;
                merged.CostPerConv = merged.Conversions ? merged.cost / merged.Conversions : 0;
            }

            return Array.from(campaignMap.values());
        },
        mergeAdGroupsBy(rawData) {
            const adGroupMap = new Map();

            for (const row of rawData) {
                const key = row.AdGroup;
                if (!adGroupMap.has(key)) {
                    adGroupMap.set(key, {
                        id: `adgroup-${adGroupMap.size + 1}`,
                        adGroup: key,
                        Status: row.Status || 'Eligible',
                        TargetCPA: row.TargetCPA || 0,
                        costPerInstall: 0,
                        costPerInAppActions: 0,
                        ViewThroughConv: 0,
                        installs: 0,
                        inAppActions: 0,
                        impressions: 0,
                        clicks: 0,
                        ParticipatedInAppActions: 0,
                        cost: 0,
                        CostPerParticipatedInAppAction: 0,
                        ConvRate: 0,
                        Conversions: 0,
                        CostPerConv: 0,
                        BrandInclusions: row.BrandInclusions || '-',
                        LocationsOfInterest: row.LocationsOfInterest || '-'
                    });
                }

                const merged = adGroupMap.get(key);
                merged.installs += safeNumber(row.installs);
                merged.inAppActions += safeNumber(row.inAppActions);
                merged.impressions += safeNumber(row.impressions);
                merged.clicks += safeNumber(row.clicks);
                merged.ParticipatedInAppActions += safeNumber(row.ParticipatedInAppActions || row.ParticlpatedInAppActions);
                merged.cost += safeNumber(row.cost);
                merged.Conversions += safeNumber(row.Conversions);

                // 汇总后计算衍生字段
                merged.costPerInstall = merged.installs ? merged.cost / merged.installs : 0;
                merged.costPerInAppActions = merged.inAppActions ? merged.cost / merged.inAppActions : 0;
                merged.CostPerParticipatedInAppAction = merged.ParticipatedInAppActions ? merged.cost / merged.ParticipatedInAppActions : 0;
                merged.ConvRate = merged.installs ? merged.Conversions / merged.installs : 0;
                merged.CostPerConv = merged.Conversions ? merged.cost / merged.Conversions : 0;
            }

            return Array.from(adGroupMap.values());
        },
        fixed(value, digits = 2) {
            return safeNumber(value).toFixed(digits);
        },
        numberOrZero(value) {
            const number = safeNumber(value);
            return Number.isInteger(number) ? String(number) : number.toFixed(2);
        },
        money(value) {
            return `$${safeNumber(value).toFixed(2)}`;
        },
        moneyOrDash(value) {
            const number = safeNumber(value);
            return number ? this.money(number) : '-';
        },
        percent(value) {
            return `${safeNumber(value).toFixed(2)}%`;
        },
        dash(value) {
            if (value === null || value === undefined || value === '') return '-';
            return value;
        },
        openUnavailablePreview() {
            this.previewModal = { type: 'unavailable' };
        },
        openImagePreview(asset) {
            this.previewModal = { type: 'image', asset };
        },
        closePreview() {
            this.previewModal = null;
        },
        handleScroll() {
            const mainElement = document.querySelector('.ga-main');
            if (mainElement) {
                this.isContextBarHidden = mainElement.scrollTop > 50;
            }
        },

        handleMouseMove(event) {
            // 实时记录鼠标位置
            this.mouseX = event.clientX
            this.mouseY = event.clientY
        },

        handleTooltipMouseOver(event) {

            // 找最近的带 tooltip 的元素
            const target = event.target.closest('[data-tooltip]')

            if (!target) {

                this.hideTooltip()

                return
            }

            // 避免同元素内部移动重复触发
            if (this.currentTooltipTarget === target) {
                return
            }

            this.currentTooltipTarget = target

// 清除旧定时器
        clearTimeout(this.tooltipTimer)

        // 延迟 0.25 秒
        this.tooltipTimer = setTimeout(() => {

            this.tooltip.text = target.dataset.tooltip

            // 鼠标位置
            this.tooltip.x = this.mouseX + 0

            // 贴近鼠标下方
            this.tooltip.y = this.mouseY + 21

            this.tooltip.visible = true

        }, 1000)
        },

        hideTooltip() {
            // 清除旧定时器
            clearTimeout(this.tooltipTimer)
            this.tooltip.visible = false
            this.currentTooltipTarget = null
        },

        toggleNotifications() {
            this.isNotificationsOpen = !this.isNotificationsOpen
        },
    },
    async mounted() {
        await this.loadData();
        document.addEventListener('click', this.closeDropdown);
        document.addEventListener('click', this.handleClickOutside);

        // Add scroll listener for hiding context bar
        const mainElement = document.querySelector('.ga-main');
        if (mainElement) {
            mainElement.addEventListener('scroll', this.handleScroll);
        }
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeDropdown);
        document.removeEventListener('click', this.handleClickOutside);

        // Remove scroll listener
        const mainElement = document.querySelector('.ga-main');
        if (mainElement) {
            mainElement.removeEventListener('scroll', this.handleScroll);
        }
    }
}).mount('#google-ads-app');
