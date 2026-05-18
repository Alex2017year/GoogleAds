const { createApp } = Vue;

createApp({
    data() {
        const defaultColumnWidths = {
            campaign: 300,
            campaignId: 150,
            cost: 120,
            impressions: 120,
            clicks: 120,
            installs: 120,
            inAppActions: 140,
            costPerInstall: 140,
            costPerInAppActions: 180,
            ctr: 120,
        };
        let savedColumnWidths = {};
        try {
            savedColumnWidths = JSON.parse(localStorage.getItem('tableColumnWidths')) || {};
        } catch (error) {
            savedColumnWidths = {};
        }

        return {
            showRightPanel: false,
            showNotification: true,
            isRefreshing: false,
            compareEnabled: false,
            dateRange: '2025年12月9日 - 2026年3月24日',
            pageSize: 10,
            pageSizeOptions: [10, 30, 50, 100],
            showPageSizeDropdown: false,
            currentPage: 1,
            sortKey: '',
            sortOrderList: {
                campaign: 'desc',
                campaignId: 'desc',
                cost: 'desc',
                impressions: 'desc',
                clicks: 'desc',
                installs: 'desc',
                inAppActions: 'desc',
                costPerInstall: 'desc',
                costPerInAppActions: 'desc',
                ctr: 'desc',
            },
            columnOrder: [
                'campaign',
                'campaignId',
                'cost',
                'impressions',
                'clicks',
                'installs',
                'inAppActions',
                'costPerInstall',
                'costPerInAppActions',
                'ctr'
            ],
            columnCssVarNames: {
                campaign: 'campaign',
                campaignId: 'campaign-id',
                cost: 'cost',
                impressions: 'impressions',
                clicks: 'clicks',
                installs: 'installs',
                inAppActions: 'in-app-actions',
                costPerInstall: 'cost-per-install',
                costPerInAppActions: 'cost-per-in-app-actions',
                ctr: 'ctr'
            },
            columnWidths: {
                ...defaultColumnWidths,
                ...savedColumnWidths
            },
            columnMinWidths: {
                campaign: 180,
                campaignId: 100,
                cost: 88,
                impressions: 88,
                clicks: 88,
                installs: 96,
                inAppActions: 128,
                costPerInstall: 128,
                costPerInAppActions: 160,
                ctr: 88
            },
            columnResizeState: null,
            resizingColumn: '',
            selectAll: false,
            filterText: localStorage.getItem('filterText') || '',
            accountText: localStorage.getItem('accountText') || '2 accounts',
            campaigns: [
                {
                    campaign: '0254-PH Space Race-Kilay',
                    cost: 7.93,
                    impressions: 32,
                    clicks: 3,
                    installs: 0.78,
                    inAppActions: 0.38,
                    costPerInstall: 10.17,
                    costPerInAppActions: 20.87,
                    ctr: 9.38,
                    selected: false
                },
            ],
            showDatePicker: false,
            selectedDateOption: 'yesterday',
            appliedDateOption: 'yesterday',
            startDate: null,
            endDate: null,
            draftStartDate: null,
            draftEndDate: null,
            calendarMonth: new Date(),
            selectingStartDate: true,
            dateSelectRef: null

        }
    },
    computed: {
        filteredCampaigns() {
            let result = this.campaigns;
            if (this.startDate && this.endDate) {
                const start = this.parseLocalDate(this.startDate);
                const end = this.parseLocalDate(this.endDate);
                if (!start || !end) return result;
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                result = result.filter(campaign => {
                    const campaignDate = this.parseLocalDate(campaign.date);
                    if (!campaignDate) return false;
                    return campaignDate >= start && campaignDate <= end;
                });
            }
            return result;
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
        dropdownStyle() {
            if (!this.showDatePicker || !this.$refs.dateSelectRef) {
                return {};
            }
            const rect = this.$refs.dateSelectRef.getBoundingClientRect();
            return {
                position: 'fixed',
                top: rect.bottom - 80 + 'px',
                right: (150) + 'px',
                zIndex: '10000'
            };
        },
        sortedCampaigns() {
            if (!this.sortKey) {
                return this.filteredCampaigns;
            }
            const key = this.sortKey;
            const order = this.sortOrderList[key];
            return [...this.filteredCampaigns].sort((a, b) => {
                let aVal = a[key];
                let bVal = b[key];
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                if (aVal < bVal) return order === 'asc' ? -1 : 1;
                if (aVal > bVal) return order === 'asc' ? 1 : -1;
                return 0;
            });
        },
        paginatedCampaigns() {
            const start = (this.currentPage - 1) * this.pageSize;
            const end = start + this.pageSize;
            return this.sortedCampaigns.slice(start, end);
        },
        totalPages() {
            return Math.ceil(this.filteredCampaigns.length / this.pageSize);
        },
        showPagination() {
            return this.filteredCampaigns.length > this.pageSize;
        },
        startRow() {
            return (this.currentPage - 1) * this.pageSize + 1;
        },
        endRow() {
            return Math.min(this.currentPage * this.pageSize, this.filteredCampaigns.length);
        },
        canGoPreviousPage() {
            return this.currentPage > 1;
        },
        canGoNextPage() {
            return this.currentPage < this.totalPages;
        },
        yesterdayDate() {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const options = { day: 'numeric', month: 'short', year: 'numeric' };
            return yesterday.toLocaleDateString('en-US', options);
        },
        totals() {
            const result = this.filteredCampaigns.reduce((acc, campaign) => {
                const impressions = Number(campaign.impressions) || 0;
                const ctr = Number(campaign.ctr);
                acc.cost += Number(campaign.cost) || 0;
                acc.impressions += impressions;
                acc.clicks += Number(campaign.clicks) || 0;
                acc.installs += Number(campaign.installs) || 0;
                acc.inAppActions += Number(campaign.inAppActions) || 0;
                if (Number.isFinite(ctr) && impressions > 0) {
                    acc.ctrWeightedSum += ctr * impressions;
                    acc.ctrImpressions += impressions;
                }
                return acc;
            }, {
                cost: 0,
                impressions: 0,
                clicks: 0,
                installs: 0,
                inAppActions: 0,
                costPerAction: 0,
                ctrWeightedSum: 0,
                ctrImpressions: 0,
                ctr: 0,
            });
            if (result.ctrImpressions > 0) {
                result.ctr = (result.ctrWeightedSum / result.ctrImpressions).toFixed(2);
            } else if (this.filteredCampaigns.length > 0 && Number(result.impressions) > 0) {
                result.ctr = ((Number(result.clicks) / Number(result.impressions)) * 100).toFixed(2);
            } else {
                result.ctr = '0.00';
            }
            return result;
        },
        hasCampaignId() {
            return this.campaigns.some(c => c.campaignId !== undefined && c.campaignId !== null && c.campaignId !== '');
        },
        totalColumnWidth() {
            return this.columnOrder.reduce((total, columnKey) => {
                if (columnKey === 'campaignId' && !this.hasCampaignId) return total;
                return total + this.getColumnWidth(columnKey);
            }, 0);
        },
        tableColumnStyle() {
            const style = {
                '--table-total-width': `${this.totalColumnWidth}px`
            };
            this.columnOrder.forEach(columnKey => {
                if (columnKey === 'campaignId' && !this.hasCampaignId) {
                    style[`--table-col-${this.columnCssVarNames[columnKey]}`] = '0px';
                } else {
                    style[`--table-col-${this.columnCssVarNames[columnKey]}`] = `${this.getColumnWidth(columnKey)}px`;
                }
            });
            return style;
        }
    },
    methods: {
        toggleRightPanel() {
        this.showRightPanel = !this.showRightPanel;
    },
    closeRightPanel() {
        this.showRightPanel = false;
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
                const d = new Date(year, month, -startDay + i + 1);
                currentWeek.push({ date: d, isCurrentMonth: false });
            }
            for (let i = 1; i <= lastDay.getDate(); i++) {
                currentWeek.push({ date: new Date(year, month, i), isCurrentMonth: true });
                if (weeks.length === 0) {
                    firstWeekCurrentMonthDays++;
                }
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
            return {
                weeks: weeks,
                firstWeekCurrentMonthDays: firstWeekCurrentMonthDays
            };
        },
        formatDate(date) {
            const d = new Date(date);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[d.getMonth()];
            const day = d.getDate();
            const year = d.getFullYear();
            return `${month} ${day}, ${year}`;
        },
        getDateOptionLabel(option) {
            const labels = {
                'today': 'Today',
                'yesterday': 'Yesterday',
                'thisWeekSunSat': 'This week (Sun - Today)',
                'thisWeekMonSun': 'This week (Mon - Today)',
                'last7Days': 'Last 7 days (up to yesterday)',
                'lastWeekSunSat': 'Last week (Sun - Sat)',
                'lastWeekMonSun': 'Last week (Mon - Sun)',
                'lastBusinessWeek': 'Last business week (Mon - Fri)',
                'last14Days': 'Last 14 days (up to yesterday)',
                'thisMonth': 'This month',
                'last30Days': 'Last 30 days',
                'lastMonth': 'Last month',
                'allTime': 'All time',
                'custom': 'Custom'
            };
            return labels[option] || 'Custom';
        },
        isSameDay(date1, date2) {
            if (!date1 || !date2) return false;
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            return d1.getFullYear() === d2.getFullYear() &&
                d1.getMonth() === d2.getMonth() &&
                d1.getDate() === d2.getDate();
        },
        isInRange(date) {
            if (!this.draftStartDate || !this.draftEndDate) return false;
            const d = new Date(date);
            return d >= new Date(this.draftStartDate) && d <= new Date(this.draftEndDate);
        },
        toggleDatePicker(event) {
            event.stopPropagation();
            if (this.showDatePicker) {
                this.cancelDateRange();
                return;
            }

            this.showDatePicker = true;
            if (this.showDatePicker) {
                this.resetDraftDateRange();
                if (this.draftStartDate) {
                    this.calendarMonth = new Date(this.draftStartDate);
                } else {
                    this.calendarMonth = new Date();
                }
                this.$nextTick(() => {
                    this.scrollToSelectedDate();
                });
            }
        },
        scrollToSelectedDate() {
            const scrollContainer = document.querySelector('.calendar-months-scroll');
            if (!scrollContainer || !this.draftStartDate) return;
            const selectedDayElement = document.querySelector('.calendar-day.selected');
            if (selectedDayElement) {
                selectedDayElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        },
        handleClickOutside(event) {
            if (this.showDatePicker) {
                const datePickerEl = document.querySelector('.date-picker-dropdown');
                const dateSelectEl = this.$refs.dateSelectRef;
                if (datePickerEl && !datePickerEl.contains(event.target) &&
                    dateSelectEl && !dateSelectEl.contains(event.target)) {
                    this.cancelDateRange();
                }
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
                case 'yesterday':
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    this.draftStartDate = new Date(yesterday);
                    this.draftEndDate = new Date(yesterday);
                    break;
                case 'thisWeekSunSat':
                    const thisWeekStartSun = new Date(today);
                    const dayOfWeekSun = thisWeekStartSun.getDay();
                    const diffToSun = dayOfWeekSun;
                    thisWeekStartSun.setDate(thisWeekStartSun.getDate() - diffToSun);
                    this.draftStartDate = new Date(thisWeekStartSun);
                    this.draftEndDate = new Date(today);
                    break;
                case 'thisWeekMonSun':
                    const thisWeekStartMon = new Date(today);
                    const dowMon = thisWeekStartMon.getDay();
                    const diffToMon = dowMon === 0 ? 6 : dowMon - 1;
                    thisWeekStartMon.setDate(thisWeekStartMon.getDate() - diffToMon);
                    this.draftStartDate = new Date(thisWeekStartMon);
                    this.draftEndDate = new Date(today);
                    break;
                case 'last7Days':
                    const last7Days = new Date(today);
                    last7Days.setDate(last7Days.getDate() - 7);
                    this.draftStartDate = last7Days;
                    const yesterdayFor7 = new Date(today);
                    yesterdayFor7.setDate(yesterdayFor7.getDate() - 1);
                    this.draftEndDate = yesterdayFor7;
                    break;
                case 'lastWeekSunSat':
                    const lastWeekSunSat = new Date(today);
                    const dayOfWeek = lastWeekSunSat.getDay();
                    const diffToLastSun = dayOfWeek === 0 ? 7 : dayOfWeek;
                    lastWeekSunSat.setDate(lastWeekSunSat.getDate() - diffToLastSun);
                    this.draftStartDate = new Date(lastWeekSunSat);
                    const lastSat = new Date(lastWeekSunSat);
                    lastSat.setDate(lastSat.getDate() + 6);
                    this.draftEndDate = lastSat;
                    break;
                case 'lastWeekMonSun':
                    const lastWeekMonSun = new Date(today);
                    const dow = lastWeekMonSun.getDay();
                    const diffToLastMon1 = dow === 1 ? 7 : (dow === 0 ? 6 : dow - 1);
                    lastWeekMonSun.setDate(lastWeekMonSun.getDate() - diffToLastMon1);
                    this.draftStartDate = new Date(lastWeekMonSun);
                    const lastSun = new Date(lastWeekMonSun);
                    lastSun.setDate(lastSun.getDate() + 6);
                    this.draftEndDate = lastSun;
                    break;
                case 'lastBusinessWeek':
                    const lastBusinessWeekStart = new Date(today);
                    const d = lastBusinessWeekStart.getDay();
                    const diffToLastMon2 = d === 1 ? 7 : (d === 0 ? 6 : d - 1);
                    lastBusinessWeekStart.setDate(lastBusinessWeekStart.getDate() - diffToLastMon2);
                    this.draftStartDate = new Date(lastBusinessWeekStart);
                    const lastFri = new Date(lastBusinessWeekStart);
                    lastFri.setDate(lastFri.getDate() + 4);
                    this.draftEndDate = lastFri;
                    break;
                case 'last14Days':
                    const last14Days = new Date(today);
                    last14Days.setDate(last14Days.getDate() - 14);
                    this.draftStartDate = last14Days;
                    const yesterdayFor14 = new Date(today);
                    yesterdayFor14.setDate(yesterdayFor14.getDate() - 1);
                    this.draftEndDate = yesterdayFor14;
                    break;
                case 'thisMonth':
                    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    this.draftStartDate = thisMonthStart;
                    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    this.draftEndDate = thisMonthEnd;
                    break;
                case 'last30Days':
                    const last30Days = new Date(today);
                    last30Days.setDate(last30Days.getDate() - 29);
                    this.draftStartDate = last30Days;
                    this.draftEndDate = new Date(today);
                    break;
                case 'lastMonth':
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    this.draftStartDate = lastMonth;
                    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                    this.draftEndDate = lastMonthEnd;
                    break;
                case 'allTime':
                    this.draftStartDate = new Date(2000, 0, 1);
                    this.draftEndDate = new Date();
                    break;
            }
            if (this.draftStartDate) {
                this.calendarMonth = new Date(this.draftStartDate);
            }
            this.$nextTick(() => {
                this.scrollToSelectedDate();
            });
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
        prevMonth() {
            this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
        },
        nextMonth() {
            this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
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
            this.currentPage = 1;
            this.showDatePicker = false;
        },
        cancelDateRange() {
            this.resetDraftDateRange();
            this.showDatePicker = false;
        },
        getColumnWidth(columnKey) {
            const width = Number(this.columnWidths[columnKey]);
            const minWidth = this.columnMinWidths[columnKey] || 88;
            if (Number.isFinite(width) && width > 0) return Math.max(minWidth, width);
            return minWidth;
        },
        getPointerClientX(event) {
            const touch = event.touches && event.touches[0]
                ? event.touches[0]
                : event.changedTouches && event.changedTouches[0];
            if (touch) return touch.clientX;
            return Number.isFinite(event.clientX) ? event.clientX : null;
        },
        startColumnResize(event, columnKey) {
            const clientX = this.getPointerClientX(event);
            if (clientX === null) return;
            this.columnResizeState = {
                columnKey,
                startX: clientX,
                startWidth: this.getColumnWidth(columnKey)
            };
            this.resizingColumn = columnKey;
            document.body.classList.add('is-column-resizing');
            document.addEventListener('mousemove', this.handleColumnResize);
            document.addEventListener('mouseup', this.stopColumnResize);
            document.addEventListener('touchmove', this.handleColumnResize, { passive: false });
            document.addEventListener('touchend', this.stopColumnResize);
            document.addEventListener('touchcancel', this.stopColumnResize);
        },
        handleColumnResize(event) {
            if (!this.columnResizeState) return;
            if (event.cancelable) event.preventDefault();
            const clientX = this.getPointerClientX(event);
            if (clientX === null) return;
            const { columnKey, startX, startWidth } = this.columnResizeState;
            const minWidth = this.columnMinWidths[columnKey] || 88;
            const nextWidth = Math.max(minWidth, Math.round(startWidth + clientX - startX));
            this.columnWidths = {
                ...this.columnWidths,
                [columnKey]: nextWidth
            };
        },
        stopColumnResize() {
            if (this.columnResizeState) {
                try {
                    localStorage.setItem('tableColumnWidths', JSON.stringify(this.columnWidths));
                } catch (error) {
                }
            }
            this.columnResizeState = null;
            this.resizingColumn = '';
            document.body.classList.remove('is-column-resizing');
            document.removeEventListener('mousemove', this.handleColumnResize);
            document.removeEventListener('mouseup', this.stopColumnResize);
            document.removeEventListener('touchmove', this.handleColumnResize);
            document.removeEventListener('touchend', this.stopColumnResize);
            document.removeEventListener('touchcancel', this.stopColumnResize);
        },
        formatCurrency(value) {
            if (value === 0 || value === undefined) return '-';
            const fixedValue = value.toFixed(2);
            const parts = fixedValue.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return '$' + parts.join('.');
        },
        formatNumber(value, decimals = 0) {
            if (value === 0 || value === undefined) return '-';
            return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        },
        formatPercent(value) {
            if (value === 0 || value === undefined) return '-';
            const numValue = Number(value);
            if (isNaN(numValue)) return '-';
            return `${numValue.toFixed(2)}%`;
        },
        sortBy(key) {
            if (this.sortKey === key) {
                this.sortOrderList[key] = this.sortOrderList[key] === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortKey = key;
                this.sortOrderList[key] = 'desc';
            }
        },
        toggleSelectAll() {
            this.campaigns.forEach(campaign => {
                campaign.selected = this.selectAll;
            });
        },
        downloadReport() {
            alert('下载功能开发中...');
        },
        saveFilter() {
            localStorage.setItem('filterText', this.filterText);
        },
        clearFilter() {
            this.filterText = '';
            localStorage.removeItem('filterText');
        },
        saveAccountText() {
            localStorage.setItem('accountText', this.accountText);
        },
        clearAccountText() {
            this.accountText = '2 accounts';
            localStorage.removeItem('accountText');
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
        async loadTableData() {
            try {
                const response = await fetch('/assets/tableData.json', { cache: 'no-store' });
                let data = await response.json();
                data = data.map((item, index) => {
                    const campaign = {
                        ...item,
                        id: item.id || `${item.campaign}-${item.date || 'no-date'}-${index}`
                    };
                    return campaign;
                });
                this.campaigns = JSON.parse(JSON.stringify(data));
            } catch (error) {
            }
        },
        async refreshPage() {
            if (this.isRefreshing) return;
            this.isRefreshing = true;
            this.showDatePicker = false;
            this.showPageSizeDropdown = false;
            try {
                await this.$nextTick();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                await Promise.all([
                    this.loadTableData(),
                    new Promise(resolve => setTimeout(resolve, 1400))
                ]);
                this.currentPage = 1;
            } finally {
                this.isRefreshing = false;
            }
        },
        togglePageSizeDropdown() {
            this.showPageSizeDropdown = !this.showPageSizeDropdown;
        },
        setPageSize(size) {
            this.pageSize = size;
            this.currentPage = 1;
            this.showPageSizeDropdown = false;
        },
    },
    async mounted() {
        await this.loadTableData();
        this.selectDateOption('yesterday');
        this.applyDateRange();
        document.addEventListener('click', this.handleClickOutside);
    },
    beforeUnmount() {
        this.stopColumnResize();
        document.removeEventListener('click', this.handleClickOutside);
    },
    watch: {
        campaigns: {
            handler(newValue) {
                this.selectAll = newValue.every(campaign => campaign.selected);
            },
            deep: true
        }
    }
}).mount('#app');
