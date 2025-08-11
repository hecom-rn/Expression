import Decimal from "decimal.js";
import { TimeUtils, TimeInstance } from '@hecom/aDate';

export type AnalyzeResult = string[];

export enum TYPE {
    ANY,
    STRING,
    NUMBER,
    BOOLEAN,
    DATETIME,
}

export interface FunctionType {
    name: string;
    returnType: TYPE;
    argsType: (index: number) => TYPE;
}

export interface FunctionTypeMap {
    [name: string]: FunctionType
}

interface User {
    code: string
    name: string
    metaName: string
    dept?: {
        code: string
        name: string
        metaName: string
        toString?(): string
    }
    owner?: User

    toString?(): string
}

interface Dept {
    code: string
    name: string
    metaName: string
    dept?: {
        code: string
        name: string
        metaName: string
        toString?(): string
    }
    owner?: User

    toString?(): string
}

export interface Config {
    currentUser?: () => User;
    nearOrg?: () => Dept;
    eval?: <T>(expr: string, bizData: object, config?: {
        null2Zero?: boolean, otherVars?: object,
    } & T) => any;
    thousandFun?: (num: number) => string;
}

interface CalculateOption {
    useNull?: boolean;
    throwException?: boolean;
    null2Zero?: boolean;
    otherVars?: any,
    evalParam?: any,
}

let defConfig: Config = {};

function setConfig(config: Config) {
    Object.assign(defConfig, config);
}

/**
 * @deprecated
 * 请直接使用 {@link setConfig}
 * @param thousandFun
 */
function setThousandFun(thousandFun: Function) {
    console.warn('setThousandFun已废弃，请直接使用setConfig函数进行统一初始化');
    Object.assign(defConfig, { thousandFun })
}

/**
 * 计算表达式的值，返回计算结果。
 * 移除可能的内存分配，尽可能优化执行效率
 * @param exprStr 表达式
 * @param data 业务对象的数据
 * @param useNull 使用null代替undefined的计算结果
 * @param throwException 计算失败时是否抛出异常
 * @param null2Zero 参与计算的值为空时，是否转0
 * @param otherVars 多变量
 * @param evalParam eval函数扩展参数
 */
function _calculateFast(exprStr: string, data?, {
    useNull = false,
    throwException = false,
    null2Zero = false,
    otherVars = null,
    evalParam,
}: CalculateOption = {}): any {
    let result = null;
    try {
        if (defConfig.eval) {
            result = defConfig.eval(exprStr, data, { null2Zero, otherVars, ...evalParam })
        } else {
            console.warn('未配置执行函数，无法完成计算');
        }
        if (useNull && result === undefined) {
            result = null;
        }
    } catch (error) {
        console.warn(`表达式：${exprStr} 计算失败`, error);
        if (throwException) {
            throw error
        }
    }
    return result;
}

/**
 * 计算表达式的值，返回计算结果。
 * @param exprStr 表达式，必须是"${...}"格式
 * @param fieldnames 表达式中应该包含哪些字段名称，不传的话，则所有不是函数的都是字段名称
 * @param data 业务对象的数据
 * @param useNull 使用null代替undefined的计算结果
 * @param throwException 计算失败时是否抛出异常
 * @param null2Zero 参与计算的值为空时，是否转0
 * @param otherVars 多变量
 */
function _calculate(exprStr: string, fieldnames?: string[], data?, {
    useNull = false,
    throwException = false,
    null2Zero = false,
    otherVars = null,
    evalParam
}: CalculateOption = {}): any {
    const expr = exprStr.slice(2, exprStr.length - 1);
    let result = null;
    try {
        const bizData = Object.assign({}, data);
        if (defConfig.eval) {
            result = defConfig.eval(expr, bizData, { null2Zero, otherVars, ...evalParam })
        } else {
            console.warn('未配置执行函数，无法完成计算');
        }
        if (useNull && result === undefined) {
            result = null;
        }
    } catch (error) {
        console.warn(`表达式：${exprStr} 计算失败`, error);
        if (throwException) {
            throw error
        }
    }
    return result;
}

/**
 * 解析表达式中包含的字段列表，查找关系内部使用数组来表示字段的层级。
 * @param exprStr 表达式
 * @param fieldnames 表达式中应该包含哪些字段名称，不传的话，则所有不是函数的都是字段名称
 */
function _analyze(exprStr: string, fieldnames: string[]): AnalyzeResult[] {
    const expr = exprStr.slice(2, exprStr.length - 1);
    const concatExprFunc = function (seperatorChar, exprParam) {
        const positions = [];
        let pos = -1;
        for (let i = 0; i < exprParam.length; i++) {
            const char = exprParam.charAt(i);
            if (char === seperatorChar) {
                if (pos < 0) {
                    pos = i;
                } else {
                    positions.push({
                        start: pos,
                        end: i,
                    });
                    pos = -1;
                }
            }
        }
        let r = exprParam;
        for (let i = positions.length - 1; i >= 0; i--) {
            const item = positions[i];
            r = r.substring(0, item.start + 1) + r.substring(item.end);
        }
        return r;
    };
    const substrExprFunc = function (exprParam) {
        const positions = [];
        let pos = -1;
        let inRelation = false;
        for (let i = 0; i < exprParam.length; i++) {
            const char = exprParam.charAt(i);
            if (char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || pos >= 0 && char >= '0' && char <= '9' || char === '_') {
                if (pos < 0) {
                    pos = i;
                }
                if (i === exprParam.length - 1) {
                    if (inRelation) {
                        positions[positions.length - 1].push({
                            start: pos,
                            end: i,
                        });
                    } else {
                        positions.push({
                            start: pos,
                            end: i,
                        });
                    }
                    pos = -1;
                }
            } else if (char === '.') {
                if (pos >= 0) {
                    if (inRelation) {
                        positions[positions.length - 1].push({
                            start: pos,
                            end: i - 1,
                        });
                    } else {
                        positions.push([{
                            start: pos,
                            end: i - 1,
                        }]);
                    }
                    pos = -1;
                    inRelation = true;
                }
            } else {
                if (pos >= 0) {
                    if (inRelation) {
                        positions[positions.length - 1].push({
                            start: pos,
                            end: i - 1,
                        });
                    } else {
                        positions.push({
                            start: pos,
                            end: i - 1,
                        });
                    }
                    pos = -1;
                    inRelation = false;
                }
            }
        }
        const variables = [];
        for (let i = positions.length - 1; i >= 0; i--) {
            const item = positions[i];
            if (Array.isArray(item)) {
                variables.push(item.map(function (itemfield) {
                    return exprParam.substring(itemfield.start, itemfield.end + 1);
                }));
            } else {
                variables.push(exprParam.substring(item.start, item.end + 1));
            }
        }
        return variables;
    };
    const funcs = [
        concatExprFunc.bind(this, '"'),
        concatExprFunc.bind(this, "'"),
    ];
    let temp = expr;
    funcs.forEach(function (func) {
        temp = func(temp);
    });
    const result = substrExprFunc(temp);
    if (Array.isArray(fieldnames) && fieldnames.length > 0) {
        return result.filter(function (varname: string[]) {
            if (Array.isArray(varname) && varname.length >= 2 && varname[0] === 'bizData') {
                return fieldnames.indexOf(varname[1]) >= 0;
            } else {
                return false;
            }
        });
    } else {
        return result.filter(function (varname: string[] | string) {
            if (Array.isArray(varname)) {
                return varname.length >= 2 && varname[0] === 'bizData';
            } else if (Object.keys(_DefaultExpressionFuncs).indexOf(varname) >= 0) {
                return false;
            } else {
                console.warn('Format error', exprStr);
                return false;
            }
        });
    }
}

const _DefaultExpressionFuncs = {
    // 数学函数
    ABS, CEILING, FLOOR, LN, LOG, MOD, ROUND, SQRT, THOUSANDSEP, MAX, MIN,
    // 时间函数
    TIMEDIF, DATEDIF, DATEDIFV2, TODAY, NOW, DATEOFFSET, TIMEOFFSET, DAY, MONTH, YEAR, TODATE, DATEVALUE, WEEKDAY, TOTIMESTAMP,
    // 逻辑函数
    AND, OR, IF, FirstNotNull, TRUE, FALSE, CASE, NULL, ISNOTNULL, ISNULL, isNULL, isNotNULL, CONTAINS, INVERT,
    // 文本函数
    LEFT, RIGHT, SEARCH, CONCATENATE, TEXT, TOCAPITAL, TO_CAPITAL_RMB, FIND, SLICE, ID_TO_AGE, TONUMBER,
    CURRENT_USER, CURRENT_ORG, CURRENT_OWNER, NEAR_ORG
};

export const FuncTypeMap: FunctionTypeMap = {
    // 文本函数
    LEFT: { name: 'LEFT', returnType: TYPE.STRING, argsType: (i) => i == 0 ? TYPE.STRING : TYPE.NUMBER },
    RIGHT: { name: 'RIGHT', returnType: TYPE.STRING, argsType: (i) => i == 0 ? TYPE.STRING : TYPE.NUMBER },
    SEARCH: { name: 'SEARCH', returnType: TYPE.BOOLEAN, argsType: () => TYPE.STRING },
    CONCATENATE: { name: 'CONCATENATE', returnType: TYPE.STRING, argsType: () => TYPE.ANY },
    TEXT: { name: 'TEXT', returnType: TYPE.STRING, argsType: () => TYPE.ANY },
    TOCAPITAL: { name: 'TOCAPITAL', returnType: TYPE.STRING, argsType: () => TYPE.NUMBER },
    TO_CAPITAL_RMB: { name: 'TO_CAPITAL_RMB', returnType: TYPE.STRING, argsType: () => TYPE.NUMBER },
    FIND: { name: 'FIND', returnType: TYPE.NUMBER, argsType: (i) => i == 0 || i == 1 ? TYPE.STRING : TYPE.NUMBER },
    SLICE: { name: 'SLICE', returnType: TYPE.STRING, argsType: (i) => i == 0 ? TYPE.STRING : TYPE.NUMBER },
    ID_TO_AGE: { name: 'ID_TO_AGE', returnType: TYPE.NUMBER, argsType: () => TYPE.STRING },
    TONUMBER: { name: 'TONUMBER', returnType: TYPE.NUMBER, argsType: () => TYPE.STRING },
    // 逻辑函数
    AND: { name: 'AND', returnType: TYPE.BOOLEAN, argsType: () => TYPE.BOOLEAN },
    OR: { name: 'OR', returnType: TYPE.BOOLEAN, argsType: () => TYPE.BOOLEAN },
    IF: { name: 'IF', returnType: TYPE.ANY, argsType: (i) => i == 0 ? TYPE.BOOLEAN : TYPE.ANY },
    FirstNotNull: { name: 'FirstNotNull', returnType: TYPE.ANY, argsType: () => TYPE.ANY },
    TRUE: { name: 'TRUE', returnType: TYPE.BOOLEAN, argsType: null },
    FALSE: { name: 'FALSE', returnType: TYPE.BOOLEAN, argsType: null },
    isNotNULL: { name: 'isNotNULL', returnType: TYPE.BOOLEAN, argsType: () => TYPE.ANY },
    ISNOTNULL: { name: 'ISNOTNULL', returnType: TYPE.BOOLEAN, argsType: () => TYPE.ANY },
    isNULL: { name: 'isNULL', returnType: TYPE.BOOLEAN, argsType: () => TYPE.ANY },
    ISNULL: { name: 'ISNULL', returnType: TYPE.BOOLEAN, argsType: () => TYPE.ANY },
    // 时间函数
    TIMEDIF: {
        name: 'TIMEDIF',
        returnType: TYPE.NUMBER,
        argsType: (i) => i == 0 || i == 1 ? TYPE.DATETIME : TYPE.STRING
    },
    DATEDIF: {
        name: 'DATEDIF',
        returnType: TYPE.NUMBER,
        argsType: (i) => i == 0 || i == 1 ? TYPE.DATETIME : TYPE.STRING
    },
    DATEDIFV2:{
        name: 'DATEDIFV2',
        returnType: TYPE.NUMBER,
        argsType: (i) => i == 0 || i == 1 ? TYPE.DATETIME : TYPE.STRING
    },
    TODAY: { name: 'TODAY', returnType: TYPE.DATETIME, argsType: null },
    NOW: { name: 'NOW', returnType: TYPE.DATETIME, argsType: null },
    DATEOFFSET: {
        name: 'DATEOFFSET',
        returnType: TYPE.DATETIME,
        argsType: (i) => i == 0 ? TYPE.DATETIME : i == 1 ? TYPE.STRING : TYPE.NUMBER
    },
    TIMEOFFSET: {
        name: 'TIMEOFFSET',
        returnType: TYPE.DATETIME,
        argsType: (i) => i == 0 ? TYPE.DATETIME : i == 1 ? TYPE.STRING : TYPE.NUMBER
    },
    DAY: { name: 'DAY', returnType: TYPE.NUMBER, argsType: () => TYPE.DATETIME },
    MONTH: { name: 'MONTH', returnType: TYPE.NUMBER, argsType: () => TYPE.DATETIME },
    YEAR: { name: 'YEAR', returnType: TYPE.NUMBER, argsType: () => TYPE.DATETIME },
    TODATE: { name: 'TODATE', returnType: TYPE.DATETIME, argsType: () => TYPE.NUMBER },
    DATEVALUE: { name: 'DATEVALUE', returnType: TYPE.STRING, argsType: () => TYPE.DATETIME },
    WEEKDAY: { name: 'WEEKDAY', returnType: TYPE.NUMBER, argsType: (i) => i == 0 ? TYPE.DATETIME : TYPE.NUMBER },
    // 数学函数
    ABS: { name: 'ABS', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    CEILING: { name: 'CEILING', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    FLOOR: { name: 'FLOOR', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    LN: { name: 'LN', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    LOG: { name: 'LOG', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    MOD: { name: 'MOD', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    ROUND: { name: 'ROUND', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    SQRT: { name: 'SQRT', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    THOUSANDSEP: { name: 'THOUSANDSEP', returnType: TYPE.STRING, argsType: () => TYPE.NUMBER },
    MAX: { name: 'MAX', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },
    MIN: { name: 'MIN', returnType: TYPE.NUMBER, argsType: () => TYPE.NUMBER },

}

function FirstNotNull(...args: any[]) {
    if (Array.isArray(args) && args.length === 0) {
        return null
    }
    for (let i = 0; i < args.length; i++) {
        if (ISNOTNULL(args[i])) {
            return args[i];
        }
    }
    return null;
}

function isNotNULL(value) {
    return ISNOTNULL(value)
}

function ISNOTNULL(value) {
    return !ISNULL(value);
}

function isNULL(value) {
    return ISNULL(value)
}

function ISNULL(value) {
    return value === null || value === undefined || value === '' ||
        typeof value === 'number' && isNaN(value) ||
        value && value.toString() === '' || Array.isArray(value) && value.length === 0;
}

function INVERT(value) {
    return Number(!value);
}

function ABS(number) {
    if (number == null || isNaN(number)) {
        return null;
    }
    return Math.abs(number);
}

function CEILING(number) {
    if (number == null || isNaN(number)) {
        return null;
    }
    const result = Math.ceil(number);
    // 排除-0的情况
    if (result == 0) {
        return 0;
    }
    return result;
}

function FLOOR(number) {
    if (number == null || isNaN(number)) {
        return null;
    }
    return Math.floor(number);
}

function LN(number) {
    if (number == null || isNaN(number)) {
        return null;
    }
    const result = Math.log(number);
    if (result === Infinity || result === -Infinity || isNaN(result)) {
        return null;
    }
    return ROUND(result, 7);
}

function LOG(number) {
    if (number == null || isNaN(number)) {
        return null;
    }
    const result = Math.log10(number);
    if (result === Infinity || result === -Infinity || isNaN(result)) {
        return null;
    }
    return ROUND(result, 7);
}

function MOD(number, divisor) {
    if (number == null || isNaN(number) || divisor == null || isNaN(divisor)) {
        return null;
    }
    const result = new Decimal(number).mod(divisor).toNumber();
    if (result === Infinity || result === -Infinity || isNaN(result)) {
        return null;
    }
    return ROUND(result, 7);
}

function ROUND(number, num_digits) {
    if (number == null || isNaN(number) || num_digits == null || isNaN(num_digits)) {
        return null;
    }
    // eslint-disable-next-line init-declarations
    let result: number;
    const decimal = new Decimal(number);
    if (num_digits < 0) {
        result = decimal.times(Math.pow(10, num_digits))
            .toDP(0, Decimal.ROUND_HALF_UP)
            .div(Math.pow(10, num_digits))
            .toNumber();
    } else {
        result = decimal.toDP(num_digits, Decimal.ROUND_HALF_UP).toNumber();
    }
    if (result == 0) return 0;
    if (result == Infinity || result == -Infinity || isNaN(result)) return null
    return result;
}

function SQRT(number) {
    if (number == null || isNaN(number)) {
        return null;
    }
    const result = Math.sqrt(number);
    if (result == Infinity || result == -Infinity || isNaN(result)) return null
    return ROUND(result, 7);
}

function TIMEDIF(startTime, endTime, unit) {
    try {
        if (startTime == null || endTime == null || unit == null) {
            return null;
        }
        const start = _dateFromAny(endTime);
        const end = _dateFromAny(startTime);
        if (start == null || end == null) {
            return null;
        }
        const diff = Number(start.valueOf()) - Number(end.valueOf());
        if (!isNaN(diff)) {
            const func = diff >= 0 ? Math.floor : Math.ceil;
            if (unit === 'h' || unit === 'H') {
                return func(diff / 1000 / 3600)
            } else if (unit === 'm') {
                return func(diff / 1000 / 60)
            } else if (unit === 's') {
                return func(diff / 1000)
            }
        }
        return null;
    } catch (e) {
        return null
    }
}

function DATEDIFV2(startTime, endTime, unit) {
    try {
        if (startTime == null || endTime == null || unit == null) {
            return null;
        }
        const startDate = TimeUtils.create(startTime).startOfDay();
        const endDate = TimeUtils.create(endTime).startOfDay();
        if (!startDate.isValid() || !endDate.isValid()) {
            return null;
        }
        if (unit === 'Y' || unit === 'y') {
            return endDate.diff(startDate, 'year');
        } else if (unit === 'M') {
            return endDate.diff(startDate, 'month');
        } else if (unit === 'D' || unit === 'd') {
            return endDate.diff(startDate, 'day');
        } else {
            return null;
        }
    } catch (e) {
        console.warn('DATEDIF error', e.toString());
        return null;
    }
}

function DATEDIF(startDateTimestamp, endDateTimestamp, unit) {
    try {
        if (startDateTimestamp == null || endDateTimestamp == null || unit == null) {
            return null;
        }
        const startDate = _dateFromAny(startDateTimestamp);
        const endDate = _dateFromAny(endDateTimestamp);
        if (!startDate?.isValid() || !endDate?.isValid()) {
            return null;
        }

        if (unit === 'Y' || unit === 'y') {
            return endDate.getYear() - startDate.getYear();
        } else if (unit === 'M') {
            return endDate.getMonth() - startDate.getMonth() + (endDate.getYear() - startDate.getYear()) * 12;
        } else if (unit === 'D' || unit === 'd') {
            const startDayStart = startDate.startOfDay();
            const endDayStart = endDate.startOfDay();
            return (endDayStart.valueOf() - startDayStart.valueOf()) / (24 * 60 * 60 * 1000);
        } else if (unit === 'MD') {
            return endDate.getDate() - startDate.getDate();
        } else if (unit === 'YM') {
            return endDate.getMonth() - startDate.getMonth();
        } else if (unit === 'YD') {
            const start1970 = startDate.year(1970).startOfDay();
            const end1970 = endDate.year(1970).startOfDay();
            return (end1970.valueOf() - start1970.valueOf()) / (24 * 60 * 60 * 1000);
        } else {
            return null;
        }
    } catch (e) {
        console.warn('DATEDIF error', e.toString());
        return null;
    }
}

function TODAY() {
    return TimeUtils.create().startOfDay().valueOf();
}

function NOW() {
    return TimeUtils.create().millisecond(0).valueOf();
}

function TIMEOFFSET(startTimestamp, unit, value) {
    try {
        if (typeof value !== 'number' || !unit || startTimestamp === undefined || startTimestamp === null) {
            return null;
        }
        const timeObj = _dateFromAny(startTimestamp);
        if (!timeObj?.isValid()) {
            return null
        }
        if (unit === 'H' || unit === 'h') {
            return timeObj.add(value, 'hour').valueOf();
        } else if (unit === 'M' || unit === 'm') {
            return timeObj.add(value, 'minute').valueOf();
        } else if (unit === 'S' || unit === 's') {
            return timeObj.add(value, 'second').valueOf();
        } else {
            return null;
        }
    } catch (e) {
        return null;
    }
}

function DATEOFFSET(startDateTimestamp, unit, value) {
    try {
        if (typeof value !== 'number' || !unit || startDateTimestamp === undefined || startDateTimestamp === null) {
            return null;
        }
        const date = TimeUtils.create(startDateTimestamp);
        if (!date.isValid()) {
            return null
        }
        let diffUnit = null;
        switch (unit) {
            case 'Y':
            case 'y':
                diffUnit = 'year';
                break;
            case 'M':
            case 'm':
                diffUnit = 'month';
                break;
            case 'D':
            case 'd':
                diffUnit = 'day';
                break;
            case 'H':
            case 'h':
                diffUnit = 'hour';
                break;
        }
        if (diffUnit == null) {
            return null;
        }
        return date.add(value, diffUnit).valueOf();
    } catch (e) {
        return null;
    }
}

function AND(...args: any[]) {
    if (args.some(arg => arg != null && typeof arg != 'boolean' && arg !== 0 && arg !== 1)) {
        return null;
    }
    let result = true;
    args.forEach(arg => {
        result = result && !!arg
    });
    return result;
}

function OR(...args: any[]) {
    if (args.some(arg => arg != null && typeof arg != 'boolean' && arg !== 0 && arg !== 1)) {
        return null;
    }
    let result = false;
    args.forEach(arg => {
        result = result || !!arg;
    });
    return result;
}

function IF(logicalTest, valueIfTrue, valueIfFalse) {
    if (logicalTest != null && typeof logicalTest != "boolean" && logicalTest !== 0 && logicalTest !== 1) {
        return null;
    }
    return logicalTest ? valueIfTrue : valueIfFalse;
}

function TRUE() {
    return true;
}

function FALSE() {
    return false;
}

function CASE() {
    if (arguments.length < 2 || arguments.length % 2 !== 0) {
        return;
    }
    const condition = arguments[0];
    for (let i = 0; i < (arguments.length - 2) / 2; i++) {
        const value = arguments[i * 2 + 1];
        const result = arguments[i * 2 + 2];
        if (condition == value || String(condition) == String(value)) {
            return result;
        }
    }
    return arguments[arguments.length - 1];
}

function NULL() {
    return null;
}

function LEFT(str, numberChars) {
    if (str == null || numberChars == null || isNaN(numberChars)) {
        return null;
    }
    return str.toString().substring(0, numberChars);
}

function RIGHT(str, numberChars) {
    if (str == null || numberChars == null || isNaN(numberChars)) {
        return null;
    }
    str = str.toString();
    return str.substring(str.length - numberChars, str.length);
}

function SEARCH(str, keyword) {
    if (str == null || keyword == null) {
        return null;
    }
    return str.toString().indexOf(keyword.toString()) !== -1;
}

function CONCATENATE(...args) {
    return args.join('');
}

function TEXT(value) {
    if (value == null || typeof value.toString != 'function') {
        return null;
    }
    return value.toString();
}

export function _dateFromAny(obj: string | number | TimeInstance): TimeInstance {
    if (typeof obj === 'string') {
        const times = obj.split(/[ :/-]/, 6).map(item => Number(item)).filter(i => !isNaN(i));
        if (times.length === 0) {
            return null;
        }
        return TimeUtils.create().year(times[0]).month((times[1] || 1) - 1).date(times[2] || 1)
            .hour(times[3] || 0).minute(times[4] || 0).second(times[5] || 0);
    } else if (typeof obj === 'number') {
        return TimeUtils.create(obj);
    } else {
        return obj;
    }
}

function TO_CAPITAL_RMB(money) {
    if (money == null || money === '' || isNaN(money)) {
        return null;
    }

    try {
        const fraction = ['角', '分'];
        const digit = [
            '零', '壹', '贰', '叁', '肆',
            '伍', '陆', '柒', '捌', '玖'
        ];
        const unit = [
            ['元', '万', '亿', '万'],
            ['', '拾', '佰', '仟']
        ];
        const head = money < 0 ? '负' : '';
        money = Math.abs(money);
        let chinese = '';
        if (String(money).split('.').length > 1) {
            for (let i = fraction.length - 1; i >= 0; i--) {
                const index = new Decimal(money).mul(10).mul(Math.pow(10, i)).mod(10).toDP(0, Decimal.ROUND_DOWN).toNumber();
                let decimal = digit[index] + fraction[i];
                !chinese && (decimal = decimal.replace(/零./, ''));
                chinese = decimal + chinese;
            }
        }
        chinese = chinese || '整';
        money = Math.floor(money);
        for (let i = 0; i < unit[0].length && money > 0; i++) {
            let cycle = '';
            for (let j = 0; j < unit[1].length && money > 0; j++) {
                cycle = digit[money % 10] + unit[1][j] + cycle;
                money = Math.floor(money / 10);
            }
            chinese = cycle.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + chinese;
        }
        return head + chinese.replace(/(零.)*零元/, '元')
            .replace(/(零.)+/g, '零')
            .replace(/^整$/, '零元整');
    } catch (e) {
        return '';
    }
}

function DAY(date) {
    if (date === undefined || date === '' || date === null) {
        return null;
    }
    const timeObj = _dateFromAny(date);
    if (!timeObj?.isValid()) {
        return null;
    }
    const day = timeObj.getDate();
    return day > 0 ? day : null;
}

function MONTH(date) {
    if (date === undefined || date === '' || date === null) {
        return null;
    }
    const timeObj = _dateFromAny(date);
    if (!timeObj?.isValid()) {
        return null;
    }
    const month = timeObj.getMonth() + 1;
    return month > 0 ? month : null;
}

function YEAR(date: string | number | TimeInstance): number | undefined {
    if (date === undefined || date === '' || date === null) {
        return null;
    }
    const time = _dateFromAny(date);
    if (!time?.isValid()) {
        return null;
    }
    const year = time.getYear();
    return year > 0 ? year : null;
}

function TODATE(year, month, day) {

    const item = [year, month, day];

    const result = item.filter(i => i === undefined || i === '' || i === null || isNaN(i));
    if (result.length > 0) {
        return null;
    }
    if (year < 1 || month > 12 || month < 1 || day < 1 || day > 31) {
        return null;
    }
    if (day > 28) {
        let limit = 31;
        if (month == 2) {
            const isLeapYear = year % 4 == 0 && year % 100 != 0 || year % 400 == 0;
            limit = isLeapYear ? 29 : 28;
        } else {
            const monthDayLimit = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            limit = monthDayLimit[month - 1];
        }
        if (day > limit) {
            return null
        }
    }
    try {
        return TimeUtils.create().year(Number(year)).month(Number(month) - 1).date(Number(day)).startOfDay().valueOf(true);
    } catch (e) {
        return null
    }
}

function THOUSANDSEP(number) {
    if (number === undefined || number === '' || number === null || isNaN(number)) {
        return null;
    }
    if (!defConfig.thousandFun) return null;
    return defConfig.thousandFun(number);
}

function MAX(...args: any[]): number {
    if (Array.isArray(args) && args.length === 0) {
        return null
    }
    // isNaN(null)的结果为false，Math.min函数认为null=0
    const numArr = args.filter(item => !isNaN(item) && item !== null && item !== undefined);
    if (numArr.length === 0) {
        return null;
    }
    return Math.max(...numArr);
}

function MIN(...args: any[]): number {
    if (Array.isArray(args) && args.length === 0) {
        return null;
    }
    // isNaN(null)的结果为false，Math.min函数认为null=0
    const numArr = args.filter(item => !isNaN(item) && item !== null && item !== undefined);
    if (numArr.length === 0) {
        return null;
    }
    return Math.min(...numArr);
}

function TOCAPITAL(number): string {
    if (number === undefined || number === null || number === '' || isNaN(number)) {
        return null;
    }

    try {
        const digit = [
            '零', '壹', '贰', '叁', '肆',
            '伍', '陆', '柒', '捌', '玖'
        ];
        const unit = [
            ['', '万', '亿', '万'],
            ['', '拾', '佰', '仟']
        ];
        const head = number < 0 ? '负' : '';
        const splitArr = number.toString().split('.');

        let integerNum = null;
        let decimalNum = null;
        let integerChinese = '';
        let decimalChinese = '';
        if (splitArr.length > 2) {
            return null;
        } else if (splitArr.length === 2) {
            integerNum = Math.abs(splitArr[0]);
            decimalNum = splitArr[1];
        } else {
            integerNum = Math.abs(splitArr[0]);
        }

        if (Math.abs(number) >= 1) {
            for (let i = 0; i < unit[0].length && integerNum > 0; i++) {
                let cycle = '';
                for (let j = 0; j < unit[1].length && integerNum > 0; j++) {
                    cycle = digit[integerNum % 10] + (digit[integerNum % 10] !== '零' ? unit[1][j] : '') + cycle;
                    integerNum = Math.floor(integerNum / 10);
                }
                integerChinese = cycle.replace(/零{2,}/, '零').replace(/零$/, '') + unit[0][i] + integerChinese;
            }
        } else {
            integerChinese = '零';
        }

        if (decimalNum) {
            const digitMap = {
                0: '零',
                1: '壹',
                2: '贰',
                3: '叁',
                4: '肆',
                5: '伍',
                6: '陆',
                7: '柒',
                8: '捌',
                9: '玖'
            };
            decimalNum.split('').forEach(item => {
                decimalChinese = decimalChinese + digitMap[item];
            });
        }
        let dot = '';
        if (decimalChinese !== '') {
            dot = '点';
        }
        return head + integerChinese + dot + decimalChinese;
    } catch (e) {
        return '';
    }
}

/**
 * 返回{@link text}中，从{@link startPoint}开始的第一个{@link targetText}的位置
 * @param targetText 目标字符串
 * @param text 原始字符串
 * @param startPoint 起始位置
 * @constructor
 * @return 位置下标，从0开始，未找到返回-1
 */
function FIND(targetText: string, text: string, startPoint: number): number {
    if (targetText == null || text == null || startPoint == null || isNaN(startPoint)) {
        return null
    }
    targetText = targetText.toString();
    text = text.toString();
    if (startPoint > text.length) {
        return -1;
    }
    if (startPoint < 0) {
        startPoint = 0;
    }
    const subStrtext = text.substring(startPoint, text.length);
    if (subStrtext.indexOf(targetText) === -1) {
        return -1;
    }
    return startPoint + subStrtext.indexOf(targetText);
}

/**
 * 判断field是否包含在options中，目前只用在单选场景中。
 * @param options
 * @param field
 * @constructor
 */
function CONTAINS(options: string[], field: string): boolean {
    return options.some((option) => option == field);
}

/**
 * 将strNum转化为数字
 * @param strNum
 * @constructor
 */
function TONUMBER(strNum: string): number {
    if (strNum === undefined || strNum === '' || strNum === null) {
        return null;
    }
    const result = Number(strNum);
    return isNaN(result) ? null : result;
}

function SLICE(text: string, startPoint: number, length: number): string {
    if (length == null || isNaN(length) || length < 0 || text == null || startPoint == null || isNaN(startPoint)) {
        return null
    }
    text = text.toString();
    if (startPoint > text.length) {
        return null;
    }
    if (startPoint < 0) {
        startPoint = 0;
    }
    return text.slice(startPoint, startPoint + length);
}

function ID_TO_AGE(idCard: string): number | null {
    if (idCard === undefined || idCard === null) {
        return null;
    }
    idCard = idCard.toString();
    const len = idCard.length;
    if (!(len === 15 || len === 18)) {
        return null;
    }
    const idCardReg = /^\d{6}(((19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])\d{3}([0-9]|x|X))|(\d{2}(0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])\d{3}))$/;
    if (!(idCardReg.test(idCard) || idCard.length == 17 && idCardReg.test(idCard.substring(0, 15)))) {
        return null;
    }
    const birth = idCard.length === 18 ? idCard.slice(6, 14) : idCard.slice(6, 12);
    // eslint-disable-next-line init-declarations
    let year, month, day;
    if (birth.length === 8) {
        year = parseInt(birth.slice(0, 4), 10);
        month = parseInt(birth.slice(4, 6), 10);
        day = parseInt(birth.slice(-2), 10)
    } else if (birth.length === 6) {
        year = parseInt('19' + birth.slice(0, 2), 10);
        month = parseInt(birth.slice(2, 4), 10);
        day = parseInt(birth.slice(-2), 10);
    } else {
        return null;
    }
    if (isNaN(month) || isNaN(day) || month > 12 || month === 0 || day > 31 || day === 0) {
        return null;
    }
    // 从身份证号解析出来的年、月、日是北京时间，计算年龄时只需要将当前时间的时区和上面的时区对齐即可，即将当前时间的时区转换到北京时区
    const currentTime = TimeUtils.create().tz('Asia/Shanghai');
    const currentTimestamp = currentTime.valueOf();
    const currentYear = currentTime.getYear();
    const birthDay = currentYear + '-' + `${month}-${day}`;
    const birthdayTimestamp = TimeUtils.create(birthDay).valueOf();
    let old = 0;
    if (currentYear - year > 0) {
        birthdayTimestamp < currentTimestamp ? old = currentYear - year :
            old = currentYear - year - 1
    }
    return old;
}

/**
 * 获取指定时间是星期几
 * @param date - 时间戳
 * @param return_type - 1：从星期日开始1-7；2：从星期一开始1-7；3：从星期一开始0-6。默认：1
 * @constructor
 */
function WEEKDAY(date: number, return_type: 1 | 2 | 3 = 1): number {
    if (typeof date !== 'number') {
        return null
    }
    const result = _dateFromAny(date);
    if (result == null) {
        return null;
    }
    const weekDay = result.getDay();
    if (return_type === 1) {
        return weekDay + 1
    } else if (return_type === 2) {
        return weekDay === 0 ? 7 : weekDay;
    } else if (return_type === 3) {
        return (weekDay + 6) % 7
    } else {
        return weekDay + 1
    }
}

function TOTIMESTAMP(date: number | string | TimeInstance): number {
    const result = _dateFromAny(date);
    if (result == null) {
        return null;
    }
    return result.valueOf();
}

function DATEVALUE(text: string | number | TimeInstance): string {
    if (text === undefined || text === '' || text === null) {
        return null;
    }
    const result = _dateFromAny(text);
    if (!result || isNaN(result?.valueOf())) {
        return null;
    }
    try {
        const year = result.getYear();
        const month = result.getMonth() + 1;
        const day = result.getDate();
        return year + '年' + month + '月' + day + '日';
    } catch (e) {
        return null;
    }
}

function NEAR_ORG() {
    if (!defConfig.nearOrg) return;
    return defConfig.nearOrg();
}

function CURRENT_USER() {
    if (!defConfig.currentUser) return;
    return defConfig.currentUser();
}

function CURRENT_ORG() {
    if (!defConfig.currentUser) return;
    const { dept } = defConfig.currentUser();
    return dept;
}

function CURRENT_OWNER(): User {
    if (!defConfig.currentUser) return;
    const { owner } = defConfig.currentUser();
    return owner;
}

export default {
    calculate: _calculate,
    calculateFast: _calculateFast,
    analyze: _analyze,
    setConfig,
    setThousandFun,
    funcMap: _DefaultExpressionFuncs
};
