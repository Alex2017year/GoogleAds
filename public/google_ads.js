const { createApp } = Vue;

const params = new URLSearchParams(window.location.search);
const CAMPAIGN_STATUS_STORAGE_KEY = 'googleAdsCampaignStatuses';
const ASSET_RANDOM_CACHE_KEY = 'googleAdsAssetRandom_';

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

createApp({
    data() {
        return {
            pageMode: getInitialPageMode(),
            dropdown: '',
            campaignStatusOverrides: readCampaignStatusOverrides(),
            isNavCollapsed: localStorage.getItem('googleAdsNavCollapsed') === 'true',
            selectedCampaignId: params.get('campaignId') || '',
            selectedAdGroupId: params.get('adGroupId') || 'adgroup-1',
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
        campaignRows() {
            return this.data.campaigns
                .filter(campaign => !campaign.isTotal && !campaign.isRemoved)
                .slice()
                .sort((left, right) => left.campaign.localeCompare(right.campaign, 'en', { numeric: true }));
        },
        adGroupRows() {
            const campaignName = params.get('campaignId') || '';
            if (!campaignName || !this.rawData.length) return [];
            const filtered = this.rawData.filter(row => row.campaign === campaignName);
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
            return this.campaignRows.reduce((acc, campaign) => {
                acc.cost += safeNumber(campaign.cost);
                acc.installs += safeNumber(campaign.installs);
                acc.inAppActions += safeNumber(campaign.inAppActions);
                acc.impressions += safeNumber(campaign.impressions);
                acc.clicks += safeNumber(campaign.clicks);
                acc.conversions += safeNumber(campaign.conversions);
                acc.viewThroughConv += safeNumber(campaign.viewThroughConv);
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
        },
        selectedCost() {
            return this.selectedCampaign ? safeNumber(this.selectedCampaign.cost) : 0;
        },
        selectedConversions() {
            return this.selectedCampaign ? safeNumber(this.selectedCampaign.conversions) : 0;
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
                const campaigns = this.mergeCampaignsBy(rawData);
                this.data = {
                    ...this.data,
                    campaigns
                };
                this.applyCampaignStatusOverrides();
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
                merged.installs += safeNumber(row.installs);
                merged.inAppActions += safeNumber(row.inAppActions);
                merged.ParticipatedInAppActions += safeNumber(row.ParticipatedInAppActions || row.ParticlpatedInAppActions);
                merged.cost += safeNumber(row.cost);
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

        // Add scroll listener for hiding context bar
        const mainElement = document.querySelector('.ga-main');
        if (mainElement) {
            mainElement.addEventListener('scroll', this.handleScroll);
        }
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeDropdown);

        // Remove scroll listener
        const mainElement = document.querySelector('.ga-main');
        if (mainElement) {
            mainElement.removeEventListener('scroll', this.handleScroll);
        }
    }
}).mount('#google-ads-app');
