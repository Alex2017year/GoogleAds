const { createApp } = Vue;

const params = new URLSearchParams(window.location.search);
const CAMPAIGN_STATUS_STORAGE_KEY = 'googleAdsCampaignStatuses';

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
                    headlines: '3/5',
                    descriptions: '3/5',
                    images: '10/20',
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
        selectedCampaign() {
            if (!this.campaignRows.length) return null;
            return this.campaignRows.find(campaign => campaign.id === this.selectedCampaignId) || this.campaignRows[0];
        },
        adGroup() {
            return this.data.adGroupTemplate;
        },
        campaignSelectorLabel() {
            return this.pageMode === 'campaigns' ? `Campaigns (${this.campaignRows.length})` : 'Campaign';
        },
        campaignQuery() {
            return this.selectedCampaign ? `campaignId=${encodeURIComponent(this.selectedCampaign.id)}` : '';
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
                acc.conversions += safeNumber(campaign.conversions);
                acc.viewThroughConv += safeNumber(campaign.viewThroughConv);
                return acc;
            }, {
                cost: 0,
                installs: 0,
                inAppActions: 0,
                conversions: 0,
                viewThroughConv: 0
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
            return this.statusDotClass(this.selectedCampaign.campaignStatus);
        },
        selectedCampaignStateLabel() {
            if (!this.selectedCampaign) return '';
            return this.selectedCampaign.campaignStatus === 'Enabled' ? 'Enabled' : 'Paused';
        },
        selectedCampaignStatusText() {
            if (!this.selectedCampaign) return '';
            return this.selectedCampaign.status || this.selectedCampaign.campaignStatus;
        },
        isSelectedCampaignProblem() {
            const text = this.selectedCampaignStatusText.toLowerCase();
            return text.includes('not') || text.includes('paused') || text.includes('disapproved') || text.includes('limited');
        },
        assetRows() {
            const campaign = this.selectedCampaign || {};
            const campaignCost = safeNumber(campaign.cost);
            const campaignInstalls = safeNumber(campaign.installs);
            const campaignInAppActions = safeNumber(campaign.inAppActions);

            return this.data.assets.map(asset => {
                const share = safeNumber(asset.share);
                const cost = campaignCost * share;
                const installs = Math.round(campaignInstalls * share);
                const inAppActions = Math.round(campaignInAppActions * share);
                const impressions = Math.round((campaignInstalls + campaignInAppActions) * share * 100);
                const clicks = Math.round(impressions * 0.03);

                return {
                    ...asset,
                    cost,
                    installs,
                    inAppActions,
                    impressions,
                    clicks,
                    ctr: impressions ? (clicks / impressions) * 100 : 0,
                    costPerInstall: installs ? cost / installs : 0,
                    costPerInAppAction: inAppActions ? cost / inAppActions : 0
                };
            }).sort((left, right) => right.cost - left.cost);
        },
        paginationText() {
            if (this.pageMode === 'adassets') {
                return `1 - ${this.assetRows.length} of ${this.assetRows.length}`;
            }
            if (this.pageMode === 'adgroups') {
                return '1 - 1 of 1';
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
                const response = await fetch('/assets/googleAdsData.json', { cache: 'no-store' });
                this.data = await response.json();
                this.applyCampaignStatusOverrides();
                if (!this.selectedCampaignId && this.pageMode !== 'campaigns' && this.campaignRows.length) {
                    this.selectedCampaignId = this.campaignRows[0].id;
                }
            } catch (error) {
                console.error('Unable to load Google Ads data', error);
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
                const status = this.campaignStatusOverrides[campaign.id];
                if (status) {
                    this.applyCampaignStatus(campaign, status);
                }
            });
        },
        setCampaignStatus(campaign, status) {
            this.applyCampaignStatus(campaign, status);
            this.campaignStatusOverrides = {
                ...this.campaignStatusOverrides,
                [campaign.id]: status
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
            return 'paused';
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
        document.addEventListener('click', this.closeDropdown, this.handleClickOutside);
        
        // Add scroll listener for hiding context bar
        const mainElement = document.querySelector('.ga-main');
        if (mainElement) {
            mainElement.addEventListener('scroll', this.handleScroll);
        }
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeDropdown, this.handleClickOutside);
        
        // Remove scroll listener
        const mainElement = document.querySelector('.ga-main');
        if (mainElement) {
            mainElement.removeEventListener('scroll', this.handleScroll);
        }
    }
}).mount('#google-ads-app');
