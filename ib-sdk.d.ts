
declare module 'ib-sdk' {

	export class Dispatch extends NodeJS.EventEmitter {
		constructor(...args: any[])

		cancel(...args: any[]): void

		connected(...args: any[]): void

		data(...args: any[]): void

		disconnected(...args: any[]): void

		end(...args: any[]): void

		error(...args: any[]): void

		instance(...args: any[]): void

		singleton(...args: any[]): void

	}

	export class RealTime extends NodeJS.EventEmitter {
		constructor(...args: any[])

		cancel(...args: any[]): void

		each(...args: any[]): void

		static init(): void

		static usingDomains: boolean

	}

	export class Session extends NodeJS.EventEmitter {
		constructor(...args: any[])

		account(...args: any[]): void

		accountSummary(...args: any[]): void

		close(...args: any[]): void

		details(...args: any[]): void

		orders(...args: any[]): void

		positions(...args: any[]): void

		securities(...args: any[]): void

		trades(...args: any[]): void

		static init(): void

		static usingDomains: boolean

	}

	export const flags: {
		ACCOUNT_TAGS: {
			accountType: string
			accruedCash: string
			availableFunds: string
			buyingPower: string
			cushion: string
			dayTradesRemaining: string
			equityWithLoanValue: string
			excessLiquidity: string
			fullAvailableFunds: string
			fullExcessLiquidity: string
			fullInitMarginReq: string
			fullMaintMarginReq: string
			grossPositionValue: string
			highestSeverity: string
			initMarginReq: string
			leverage: string
			lookAheadAvailableFunds: string
			lookAheadExcessLiquidity: string
			lookAheadInitMarginReq: string
			lookAheadMaintMarginReq: string
			lookAheadNextChange: string
			maintMarginReq: string
			netLiquidation: string
			previousDayEquityWithLoanValue: string
			regTEquity: string
			regTMargin: string
			settledCash: string
			sma: string
			totalCashValue: string
		}
		CURRENCIES: string[]
		FUNDAMENTALS_REPORTS: {
			calendar: string
			consensus: string
			financials: string
			ratios: string
			snapshot: string
			statements: string
		}
		HISTORICAL: {
			ask: string
			bid: string
			bidAsk: string
			fee: string
			historicalVol: string
			midpoint: string
			optionVol: string
			rebate: string
			trades: string
			yieldAsk: string
			yieldBid: string
			yieldBidAsk: string
			yieldLast: string
		}
		OCA_TYPE: {
			cancel: number
			reduce: number
			reduceWithoutOverfillProtection: number
		}
		ORDER_TYPE: {
			limit: string
			limitIfTouched: string
			limitOnClose: string
			market: string
			marketIfTouched: string
			marketOnClose: string
			marketProtect: string
			marketToLimit: string
			stop: string
			stopLimit: string
			stopProtect: string
			trailingLimitIfTouched: string
			trailingMarketIfTouched: string
			trailingStop: string
			trailingStopLimit: string
		}
		QUOTE_TICK_TYPES: {
			auctionValues: number
			dividends: number
			fundamentalRatios: number
			futuresOpenInterest: number
			historicalVolatility: number
			indexFuturePremium: number
			markPrice: number
			news: number
			optionImpliedVolatility: number
			optionOpenInterest: number
			optionVolume: number
			priceRange: number
			realTimeVolume: number
			realtimeHistoricalVolatility: number
			shortable: number
			tradeCount: number
			tradeRate: number
			volumeRate: number
		}
		RULE80A: {
			agency: string
			agencyPT: string
			agencyPTIA: string
			agentOtherMember: string
			agentOtherMemberPT: string
			agentOtherMemberPTIA: string
			individual: string
			individualPT: string
			individualPTIA: string
		}
		SECURITY_TYPE: {
			bag: string
			call: string
			calls: string
			cash: string
			currency: string
			equity: string
			forward: string
			forwards: string
			future: string
			futures: string
			index: string
			news: string
			option: string
			put: string
			puts: string
			stock: string
		}
		SIDE: {
			buy: string
			sell: string
			short: string
		}
		TIME_IN_FORCE: {
			auction: string
			day: string
			fillOrKill: string
			goodTilCancelled: string
			goodUntil: string
			goodUntilCancelled: string
			immediateOrCancel: string
			open: string
		}
	}

	export const id: number

	export const studies: {}

	export function MarketData(...args: any[]): void

	export function Proxy(...args: any[]): void

	export function Service(...args: any[]): any

	export function open(options: any, cb: any): void

	export function proxy(socket: any, dispatch: any): any

	export function session(options: any): any

	export namespace IB {

		const BAG_SEC_TYPE: string

		const CLIENT_VERSION: number

		const DEFAULT_CLIENT_ID: number

		const DEFAULT_HOST: string

		const DEFAULT_PORT: number

		const EXERCISE_ACTION: {
			EXERCISE: number
			LAPSE: number
		}

		const FA_DATA_TYPE: {
			ALIASES: number
			GROUPS: number
			PROFILES: number
		}

		const INCOMING: {
			ACCOUNT_SUMMARY: number
			ACCOUNT_SUMMARY_END: number
			ACCOUNT_UPDATE_MULTI: number
			ACCOUNT_UPDATE_MULTI_END: number
			ACCT_DOWNLOAD_END: number
			ACCT_UPDATE_TIME: number
			ACCT_VALUE: number
			BOND_CONTRACT_DATA: number
			COMMISSION_REPORT: number
			CONTRACT_DATA: number
			CONTRACT_DATA_END: number
			CURRENT_TIME: number
			DELTA_NEUTRAL_VALIDATION: number
			DISPLAY_GROUP_LIST: number
			DISPLAY_GROUP_UPDATED: number
			ERR_MSG: number
			EXECUTION_DATA: number
			EXECUTION_DATA_END: number
			FAMILY_CODES: number
			FUNDAMENTAL_DATA: number
			HEAD_TIMESTAMP: number
			HISTOGRAM_DATA: number
			HISTORICAL_DATA: number
			HISTORICAL_NEWS: number
			HISTORICAL_NEWS_END: number
			MANAGED_ACCTS: number
			MARKET_DATA_TYPE: number
			MARKET_DEPTH: number
			MARKET_DEPTH_L2: number
			MKT_DEPTH_EXCHANGES: number
			NEWS_ARTICLE: number
			NEWS_BULLETINS: number
			NEWS_PROVIDERS: number
			NEXT_VALID_ID: number
			OPEN_ORDER: number
			OPEN_ORDER_END: number
			ORDER_STATUS: number
			PORTFOLIO_VALUE: number
			POSITION: number
			POSITION_END: number
			POSITION_MULTI: number
			POSITION_MULTI_END: number
			REAL_TIME_BARS: number
			RECEIVE_FA: number
			SCANNER_DATA: number
			SCANNER_PARAMETERS: number
			SECURITY_DEFINITION_OPTION_PARAMETER: number
			SECURITY_DEFINITION_OPTION_PARAMETER_END: number
			SMART_COMPONENTS: number
			SOFT_DOLLAR_TIERS: number
			SYMBOL_SAMPLES: number
			TICK_EFP: number
			TICK_GENERIC: number
			TICK_NEWS: number
			TICK_OPTION_COMPUTATION: number
			TICK_PRICE: number
			TICK_REQ_PARAMS: number
			TICK_SIZE: number
			TICK_SNAPSHOT_END: number
			TICK_STRING: number
			VERIFY_AND_AUTH_COMPLETED: number
			VERIFY_AND_AUTH_MESSAGE_API: number
			VERIFY_COMPLETED: number
			VERIFY_MESSAGE_API: number
		}

		const LOG_LEVEL: {
			DETAIL: number
			ERROR: number
			INFO: number
			SYSTEM: number
			WARN: number
		}

		const MAX_REQ_PER_SECOND: number

		const MIN_SERVER_VER: {
			ACCT_SUMMARY: number
			AGG_GROUP: number
			ALGO_ID: number
			ALGO_ORDERS: number
			CANCEL_CALC_IMPLIED_VOLAT: number
			CANCEL_CALC_OPTION_PRICE: number
			CANCEL_HEADTIMESTAMP: number
			CASH_QTY: number
			CFD_REROUTE: number
			CONTRACT_CONID: number
			CONTRACT_DATA_CHAIN: number
			DELTA_NEUTRAL_CONID: number
			DELTA_NEUTRAL_OPEN_CLOSE: number
			EXECUTION_DATA_CHAIN: number
			EXT_OPERATOR: number
			FRACTIONAL_POSITIONS: number
			FUNDAMENTAL_DATA: number
			HEDGE_ORDERS: number
			LINKING: number
			LINKING_AUTH: number
			MARKET_RULES: number
			MD_SIZE_MULTIPLIER: number
			MODELS_SUPPORT: number
			NEWS_QUERY_ORIGINS: number
			NOT_HELD: number
			OPTIONAL_CAPABILITIES: number
			OPT_OUT_SMART_ROUTING: number
			ORDER_COMBO_LEGS_PRICE: number
			ORDER_SOLICITED: number
			PAST_LIMIT: number
			PEGGED_TO_BENCHMARK: number
			PLACE_ORDER_CONID: number
			PNL: number
			POSITIONS: number
			PRIMARYEXCH: number
			PTA_ORDERS: number
			RANDOMIZE_SIZE_AND_PRICE: number
			REAL_TIME_BARS: number
			REQ_CALC_IMPLIED_VOLAT: number
			REQ_CALC_OPTION_PRICE: number
			REQ_FAMILY_CODES: number
			REQ_GLOBAL_CANCEL: number
			REQ_HEAD_TIMESTAMP: number
			REQ_HISTOGRAM: number
			REQ_HISTORICAL_NEWS: number
			REQ_MARKET_DATA_TYPE: number
			REQ_MATCHING_SYMBOLS: number
			REQ_MKT_DATA_CONID: number
			REQ_MKT_DEPTH_EXCHANGES: number
			REQ_NEWS_ARTICLE: number
			REQ_NEWS_PROVIDERS: number
			REQ_SMART_COMPONENTS: number
			SCALE_ORDERS: number
			SCALE_ORDERS2: number
			SCALE_ORDERS3: number
			SCALE_TABLE: number
			SEC_DEF_OPT_PARAMS_REQ: number
			SEC_ID_TYPE: number
			SERVER_VER_UNREALIZED_PNL: number
			SERVICE_DATA_TYPE: number
			SMART_COMBO_ROUTING_PARAMS: number
			SNAPSHOT_MKT_DATA: number
			SOFT_DOLLAR_TIER: number
			SSHORTX: number
			SSHORTX_OLD: number
			SSHORT_COMBO_LEGS: number
			SYNT_REALTIME_BARS: number
			TICK_NEWS: number
			TRADING_CLASS: number
			TRAILING_PERCENT: number
			UNDERLYING_INFO: number
			UNDER_COMP: number
			WHAT_IF_ORDERS: number
		}

		const OUTGOING: {
			CANCEL_ACCOUNT_SUMMARY: number
			CANCEL_ACCOUNT_UPDATES_MULTI: number
			CANCEL_CALC_IMPLIED_VOLAT: number
			CANCEL_CALC_OPTION_PRICE: number
			CANCEL_FUNDAMENTAL_DATA: number
			CANCEL_HISTOGRAM_DATA: number
			CANCEL_HISTORICAL_DATA: number
			CANCEL_MKT_DATA: number
			CANCEL_MKT_DEPTH: number
			CANCEL_NEWS_BULLETINS: number
			CANCEL_ORDER: number
			CANCEL_POSITIONS: number
			CANCEL_POSITIONS_MULTI: number
			CANCEL_REAL_TIME_BARS: number
			CANCEL_SCANNER_SUBSCRIPTION: number
			EXERCISE_OPTIONS: number
			PLACE_ORDER: number
			QUERY_DISPLAY_GROUPS: number
			REPLACE_FA: number
			REQ_ACCOUNT_DATA: number
			REQ_ACCOUNT_SUMMARY: number
			REQ_ACCOUNT_UPDATES_MULTI: number
			REQ_ALL_OPEN_ORDERS: number
			REQ_AUTO_OPEN_ORDERS: number
			REQ_CALC_IMPLIED_VOLAT: number
			REQ_CALC_OPTION_PRICE: number
			REQ_CONTRACT_DATA: number
			REQ_CURRENT_TIME: number
			REQ_EXECUTIONS: number
			REQ_FA: number
			REQ_FAMILY_CODES: number
			REQ_FUNDAMENTAL_DATA: number
			REQ_GLOBAL_CANCEL: number
			REQ_HEAD_TIMESTAMP: number
			REQ_HISTOGRAM_DATA: number
			REQ_HISTORICAL_DATA: number
			REQ_HISTORICAL_NEWS: number
			REQ_IDS: number
			REQ_MANAGED_ACCTS: number
			REQ_MARKET_DATA_TYPE: number
			REQ_MATCHING_SYMBOLS: number
			REQ_MKT_DATA: number
			REQ_MKT_DEPTH: number
			REQ_MKT_DEPTH_EXCHANGES: number
			REQ_NEWS_ARTICLE: number
			REQ_NEWS_BULLETINS: number
			REQ_NEWS_PROVIDERS: number
			REQ_OPEN_ORDERS: number
			REQ_POSITIONS: number
			REQ_POSITIONS_MULTI: number
			REQ_REAL_TIME_BARS: number
			REQ_SCANNER_PARAMETERS: number
			REQ_SCANNER_SUBSCRIPTION: number
			REQ_SEC_DEF_OPT_PARAMS: number
			REQ_SMART_COMPONENTS: number
			REQ_SOFT_DOLLAR_TIERS: number
			SET_SERVER_LOGLEVEL: number
			START_API: number
			SUBSCRIBE_TO_GROUP_EVENTS: number
			UNSUBSCRIBE_FROM_GROUP_EVENTS: number
			UPDATE_DISPLAY_GROUP: number
			VERIFY_AND_AUTH_MESSAGE: number
			VERIFY_AND_AUTH_REQUEST: number
			VERIFY_MESSAGE: number
			VERIFY_REQUEST: number
		}

		const SERVER_VERSION: number

		const TICK_TYPE: {
			ASK: number
			ASK_EFP_COMPUTATION: number
			ASK_EXCH: number
			ASK_OPTION: number
			ASK_SIZE: number
			ASK_YIELD: number
			AUCTION_IMBALANCE: number
			AUCTION_PRICE: number
			AUCTION_VOLUME: number
			AVG_VOLUME: number
			BID: number
			BID_EFP_COMPUTATION: number
			BID_EXCH: number
			BID_OPTION: number
			BID_SIZE: number
			BID_YIELD: number
			BOND_FACTOR_MULTIPLIER: number
			CLOSE: number
			CLOSE_EFP_COMPUTATION: number
			CREDITMAN_MARK_PRICE: number
			CREDITMAN_SLOW_MARK_PRICE: number
			CUST_OPTION_COMPUTATION: number
			DELAYED_ASK: number
			DELAYED_ASK_OPTION: number
			DELAYED_ASK_SIZE: number
			DELAYED_BID: number
			DELAYED_BID_OPTION: number
			DELAYED_BID_SIZE: number
			DELAYED_CLOSE: number
			DELAYED_HIGH: number
			DELAYED_LAST: number
			DELAYED_LAST_OPTION: number
			DELAYED_LAST_SIZE: number
			DELAYED_LOW: number
			DELAYED_MODEL_OPTION: number
			DELAYED_OPEN: number
			DELAYED_VOLUME: number
			FUNDAMENTAL_RATIOS: number
			FUTURES_OPEN_INTEREST: number
			HALTED: number
			HIGH: number
			HIGH_13_WEEK: number
			HIGH_26_WEEK: number
			HIGH_52_WEEK: number
			HIGH_EFP_COMPUTATION: number
			IB_DIVIDENDS: number
			INDEX_FUTURE_PREMIUM: number
			LAST: number
			LAST_EFP_COMPUTATION: number
			LAST_EXCH: number
			LAST_OPTION: number
			LAST_REG_TIME: number
			LAST_RTH_TRADE: number
			LAST_SIZE: number
			LAST_TIMESTAMP: number
			LAST_YIELD: number
			LOW: number
			LOW_13_WEEK: number
			LOW_26_WEEK: number
			LOW_52_WEEK: number
			LOW_EFP_COMPUTATION: number
			MARK_PRICE: number
			MODEL_OPTION: number
			NEWS_TICK: number
			OPEN: number
			OPEN_EFP_COMPUTATION: number
			OPEN_INTEREST: number
			OPTION_ASK_EXCH: number
			OPTION_BID_EXCH: number
			OPTION_CALL_OPEN_INTEREST: number
			OPTION_CALL_VOLUME: number
			OPTION_HISTORICAL_VOL: number
			OPTION_IMPLIED_VOL: number
			OPTION_PUT_OPEN_INTEREST: number
			OPTION_PUT_VOLUME: number
			REGULATORY_IMBALANCE: number
			RT_HISTORICAL_VOL: number
			RT_TRD_VOLUME: number
			RT_VOLUME: number
			SHORTABLE: number
			SHORT_TERM_VOLUME_10_MIN: number
			SHORT_TERM_VOLUME_3_MIN: number
			SHORT_TERM_VOLUME_5_MIN: number
			TRADE_COUNT: number
			TRADE_RATE: number
			UNKNOWN: number
			VOLUME: number
			VOLUME_RATE: number
		}

		const VERSION: string

		const _events: any

		const _maxListeners: any

		const domain: any

		function _send(...args: any[]): void

		function addListener(type: any, listener: any): any

		function calculateImpliedVolatility(reqId: any, contract: any, optionPrice: any, underPrice: any): any

		function calculateOptionPrice(reqId: any, contract: any, volatility: any, underPrice: any): any

		function cancelAccountSummary(reqId: any): any

		function cancelCalculateImpliedVolatility(reqId: any): any

		function cancelCalculateOptionPrice(reqId: any): any

		function cancelFundamentalData(reqId: any): any

		function cancelHistoricalData(tickerId: any): any

		function cancelMktData(tickerId: any): any

		function cancelMktDepth(tickerId: any): any

		function cancelNewsBulletins(): any

		function cancelOrder(id: any): any

		function cancelPositions(): any

		function cancelRealTimeBars(tickerId: any): any

		function cancelScannerSubscription(tickerId: any): any

		function connect(): any

		function disconnect(): any

		function emit(type: any, ...args: any[]): any

		function eventNames(): any

		function exerciseOptions(tickerId: any, contract: any, exerciseAction: any, exerciseQuantity: any, account: any, override: any): any

		function getMaxListeners(): any

		function listenerCount(type: any): any

		function listeners(type: any): any

		function on(type: any, listener: any): any

		function once(type: any, listener: any): any

		function placeOrder(id: any, contract: any, order: any): any

		function prependListener(type: any, listener: any): any

		function prependOnceListener(type: any, listener: any): any

		function queryDisplayGroups(reqId: any): any

		function removeAllListeners(type: any, ...args: any[]): any

		function removeListener(type: any, listener: any): any

		function replaceFA(faDataType: any, xml: any): any

		function reqAccountSummary(reqId: any, group: any, tags: any): any

		function reqAccountUpdates(subscribe: any, acctCode: any): any

		function reqAllOpenOrders(): any

		function reqAutoOpenOrders(bAutoBind: any): any

		function reqContractDetails(reqId: any, contract: any): any

		function reqCurrentTime(): any

		function reqExecutions(reqId: any, filter: any): any

		function reqFundamentalData(reqId: any, contract: any, reportType: any): any

		function reqGlobalCancel(): any

		function reqHeadTimestamp(reqId: any, contract: any, whatToShow: any, useRTH: any, formatDate: any): void

		function reqHistoricalData(tickerId: any, contract: any, endDateTime: any, durationStr: any, barSizeSetting: any, whatToShow: any, useRTH: any, formatDate: any, keepUpToDate: any): any

		function reqIds(numIds: any): any

		function reqManagedAccts(): any

		function reqMarketDataType(marketDataType: any): any

		function reqMktData(tickerId: any, contract: any, genericTickList: any, snapshot: any, regulatorySnapshot: any): any

		function reqMktDepth(tickerId: any, contract: any, numRows: any): any

		function reqNewsBulletins(allMsgs: any): any

		function reqOpenOrders(): any

		function reqPositions(): any

		function reqRealTimeBars(tickerId: any, contract: any, barSize: any, whatToShow: any, useRTH: any): any

		function reqScannerParameters(): any

		function reqScannerSubscription(tickerId: any, subscription: any): any

		function reqSecDefOptParams(reqId: any, underlyingSymbol: any, futFopExchange: any, underlyingSecType: any, underlyingConId: any): any

		function requestFA(faDataType: any): any

		function setMaxListeners(n: any): any

		function setServerLogLevel(logLevel: any): any

		function subscribeToGroupEvents(reqId: any, groupId: any): any

		function unsubscribeToGroupEvents(reqId: any): any

		function updateDisplayGroup(reqId: any, contractInfo: any): any

		namespace contract {
			function cfd(symbol: any, exchange: any, currency: any): any

			function combo(symbol: any, currency: any, exchange: any): any

			function fop(symbol: any, expiry: any, strike: any, right: any, multiplier: any, exchange: any, currency: any): any

			function forex(symbol: any, currency: any): any

			function future(symbol: any, expiry: any, currency: any, exchange: any, multiplier: any): any

			function index(symbol: any, expiry: any, currency: any, exchange: any): any

			function option(symbol: any, expiry: any, strike: any, right: any, exchange: any, currency: any): any

			function stock(symbol: any, exchange: any, currency: any): any
		}

		namespace order {
			function limit(action: any, quantity: any, price: any, transmitOrder: any): any

			function market(action: any, quantity: any, transmitOrder: any, goodAfterTime: any, goodTillDate: any): any

			function marketClose(action: any, quantity: any, transmitOrder: any): any

			function stop(action: any, quantity: any, price: any, transmitOrder: any, parentId: any, tif: any): any

			function stopLimit(action: any, quantity: any, limitPrice: any, stopPrice: any, transmitOrder: any, parentId: any, tif: any): any

			function trailingStop(action: any, quantity: any, auxPrice: any, tif: any, transmitOrder: any, parentId: any): any
		}

		namespace util {
			function incomingToString(incoming: any): any

			function numberToString(number: any): any

			function outgoingToString(outgoing: any): any

			function tickTypeToString(tickType: any): any
		}

	}

}
