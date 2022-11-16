export type AnalyzeResult = string[];

interface User {
    code: string
    name: string
    metaName: string
    dept?: {
        code: string
        name: string
        metaName: string
    }

    toString?(): string
}

interface Config {
    currentUser?: () => User;
    eval?: (expr: string, bizData: object, null2Zero?: boolean) => any;
    superiors?: () => User;
    thousandFun?: (num: number) => string;
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
    Object.assign(defConfig, {thousandFun})
}

/**
 * 计算表达式的值，返回计算结果。
 * 移除可能的内存分配，尽可能优化执行效率
 * @param exprStr 表达式
 * @param data 业务对象的数据
 * @param useNull 使用null代替undefined的计算结果
 * @param throwException 计算失败时是否抛出异常
 */
function _calculateFast(exprStr: string, data?, {
    useNull = false,
    throwException = false,
    null2Zero = false
} = {}): any {
    let result;
    try {
        const bizData = data;
        if (defConfig.eval) {
            result = defConfig.eval(exprStr, bizData, null2Zero)
        } else {
            eval('result = ' + exprStr);
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
 */
function _calculate(exprStr: string, fieldnames?: string[], data?, {
    useNull = false,
    throwException = false
} = {}): any {
    const expr = exprStr.slice(2, exprStr.length - 1);
    let result;
    try {
        const bizData = Object.assign({}, data);
        if (defConfig.eval) {
            result = defConfig.eval(expr, bizData)
        } else {
            eval('result = ' + expr);
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
    TIMEDIF, DATEDIF, TODAY, NOW, DATEOFFSET, TIMEOFFSET, DAY, MONTH, YEAR, TODATE, DATEVALUE, WEEKDAY,
    // 逻辑函数
    AND, OR, IF, FirstNotNull, TRUE, FALSE, CASE, NULL, ISNOTNULL, ISNULL, isNULL, isNotNULL, CONTAINS, INVERT,
    // 文本函数
    LEFT, RIGHT, SEARCH, CONCATENATE, TEXT, TOCAPITAL, TO_CAPITAL_RMB, FIND, SLICE, ID_TO_AGE, TONUMBER,
    CURRENT_USER, CURRENT_ORG, CURRENT_OWNER
};

function FirstNotNull(...args: any[]) {
    if (Array.isArray(args) && args.length === 0) {
        throw new Error('缺少参数')
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
        (typeof value === 'number' && isNaN(value)) ||
        (value && value.toString() === '') || (Array.isArray(value) && value.length === 0);
}

function INVERT(value) {
    return Number(!value);
}

function ABS(number) {
    return Math.abs(number);
}

function CEILING(number) {
    return Math.ceil(number);
}

function FLOOR(number) {
    return Math.floor(number);
}

function LN(number) {
    return Math.log(number);
}

function LOG(number) {
    return Math.log10(number);
}

function MOD(number, divisor) {
    return number % divisor;
}

function ROUND(number, num_digits) {
    let x = 1;
    for (let i = 0; i < num_digits; i++) {
        x = x * 10;
    }
    return Math.round(number * x) / x;
}

function SQRT(number) {
    return Math.sqrt(number);
}

function TIMEDIF(startTime, endTime, unit) {
    const diff = Number(endTime) - Number(startTime);
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
    return 0;
}

function DATEDIF(startDateTimestamp, endDateTimestamp, unit) {
    const setDayIgnoreHour = function (time) {
        time.setHours(0);
        time.setMinutes(0);
        time.setSeconds(0);
        time.setMilliseconds(0);
    };
    try {
        const startDate = _dateFromAny(startDateTimestamp);
        const endDate = _dateFromAny(endDateTimestamp);
        if (unit === 'Y' || unit === 'y') {
            return endDate.getFullYear() - startDate.getFullYear();
        } else if (unit === 'M') {
            return endDate.getMonth() - startDate.getMonth() + (endDate.getFullYear() - startDate.getFullYear()) * 12;
        } else if (unit === 'D' || unit === 'd') {
            setDayIgnoreHour(startDate);
            setDayIgnoreHour(endDate);
            return (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
        } else if (unit === 'MD') {
            return endDate.getDate() - startDate.getDate();
        } else if (unit === 'YM') {
            return endDate.getMonth() - startDate.getMonth();
        } else if (unit === 'YD') {
            const setIgnoreYearUseDay = function (time) {
                time.setFullYear(1970);
                setDayIgnoreHour(time);
            };
            setIgnoreYearUseDay(startDate);
            setIgnoreYearUseDay(endDate);
            return (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
        } else {
            return 0;
        }
    } catch (e) {
        console.warn('DATEDIF error', e.toString());
        return '';
    }
}

function TODAY() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
}

function NOW() {
    const now = new Date();
    now.setMilliseconds(0);
    return now.getTime();
}

function TIMEOFFSET(startTimestamp, unit, value) {
    if (typeof value !== 'number') {
        throw new Error('TIMEOFFSET中: value需要是数值类型');
    }
    if (!unit) {
        throw new Error('TIMEOFFSET中: unit为必填');
    }
    if (startTimestamp === undefined) {
        throw new Error('TIMEOFFSET中: 开始时间为必填');
    }
    const date = _dateFromAny(startTimestamp);
    if (unit === 'H' || unit === 'h') {
        return date.getTime() + value * 60 * 60 * 1000;
    } else if (unit === 'M' || unit === 'm') {
        return date.getTime() + value * 60 * 1000;
    } else if (unit === 'S' || unit === 's') {
        return date.getTime() + value * 1000;
    } else {
        return date.getTime();
    }
}

function DATEOFFSET(startDateTimestamp, unit, value) {
    if (typeof value !== 'number' ) {
        throw new Error('DATEOFFSET: value需要是数值类型');
    }
    if (!unit) {
        throw new Error('DATEOFFSET: unit为必填');
    }
    if (startDateTimestamp === undefined) {
        throw new Error('DATEOFFSET: 开始时间为必填');
    }
    const date = _dateFromAny(startDateTimestamp);
    if (unit === 'Y' || unit === 'y') {
        date.setFullYear(date.getFullYear() + value);
        return date.getTime();
    } else if (unit === 'M' || unit === 'm') {
        const preDay = date.getDate();
        date.setMonth(date.getMonth() + value);
        const curDay = date.getDate();
        let nextDay = date.getDate();
        while (!(preDay === curDay  || nextDay > curDay)) {
            date.setTime(date.getTime() - 24 * 60 * 60 * 1000);
            nextDay = date.getDate();
        }
        return date.getTime();
    } else if (unit === 'D' || unit === 'd') {
        return date.getTime() + value * 24 * 60 * 60 * 1000;
    } else if (unit === 'H' || unit === 'h') {
        return date.getTime() + value * 60 * 60 * 1000;
    } else {
        return date.getTime();
    }
}

function AND(...args: any[]) {
    let result = true;
    args.forEach(arg => {
        result = result && arg
    });
    return result;
}

function OR(...args: any[]) {
    let result = false;
    args.forEach(arg => {
        result = result || arg;
    });
    return result;
}

function IF(logicalTest, valueIfTrue, valueIfFalse) {
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
    if (isNaN(numberChars)) {
        throw new Error('numberChars: ' + numberChars + ' 必须是一个数值')
    }
    return str.toString().substring(0, numberChars);
}

function RIGHT(str, numberChars) {
    if (isNaN(numberChars)) {
        throw new Error('numberChars: ' + numberChars + ' 必须是一个数值')
    }
    str = str.toString();
    return str.substring(str.length - numberChars, str.length);
}

function SEARCH(str, keyword) {
    return str.toString().indexOf(keyword.toString()) !== -1;
}

function CONCATENATE() {
    return Array.prototype.join.call(arguments, '');
}

function TEXT(value) {
    return value.toString();
}

function CURRENT_USER() {
    if (!defConfig.currentUser) return;
    const user = defConfig.currentUser();
    return {
        code: user.code,
        name: user.name,
        metaName: user.metaName,
        toString() {
            return this.name;
        }
    };
}

function CURRENT_ORG() {
    if (!defConfig.currentUser) return;
    const {dept} = defConfig.currentUser();
    return {
        code: dept.code,
        name: dept.name,
        metaName: dept.metaName,
        toString() {
            return this.name;
        }
    };
}

function _dateFromAny(obj: string | number | Date): Date {
    if (typeof obj === 'string') {
        const times = obj.split(/[ :/-]/, 6).map(item => Number(item));
        return new Date(times[0], times[1] - 1 || 0, times[2] || 1, times[3] || 0, times[4] || 0, times[5] || 0);
    } else if (typeof obj === 'number') {
        return new Date(obj);
    } else {
        return obj;
    }
}

function TO_CAPITAL_RMB(money) {
    if (money === undefined || money === null || money === '') {
        return '';
    }

    try {
        if (isNaN(money)) {
            return '';
        }
        const fraction = ['角', '分'];
        const digit = [
            '零', '壹', '贰', '叁', '肆',
            '伍', '陆', '柒', '捌', '玖'
        ];
        const unit = [
            ['元', '万', '亿'],
            ['', '拾', '佰', '仟']
        ];
        const head = money < 0 ? '负' : '';
        money = Math.abs(money);
        let chinese = '';
        for (let i = 0; i < fraction.length; i++) {
            chinese += (digit[Math.floor(money * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
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
        return undefined;
    }
    const time = _dateFromAny(date);
    const day = time ? time.getDate() : undefined;
    return (day > 0) ? day : undefined;
}

function MONTH(date) {
    if (date === undefined || date === '' || date === null) {
        return undefined;
    }
    const time = _dateFromAny(date);
    const month = time ? (time.getMonth() + 1) : undefined;
    return (month > 0) ? month : undefined;
}

function YEAR(date: string | number | Date): number | undefined {
    if (date === undefined || date === '' || date === null) {
        return undefined;
    }
    const time = _dateFromAny(date);
    const year = time ? time.getFullYear() : undefined;
    return (year > 0) ? year : undefined;
}

function TODATE(year, month, day) {

    const item = [{'key': year}, {'key': month}, {'key': day}];

    const result = item.filter(i => (i.key === undefined || i.key === '' || i.key === null || isNaN(i.key)));
    if (result.length > 0) {
        return 0;
    }
    try {
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        const result = date.getTime();
        if (result > 0) {
            return result;
        }
    } catch (e) {
        throw 'error';
    }
    return 0;
}

function THOUSANDSEP(number) {
    if (number === undefined || number === '' || number === null || isNaN(number)) {
        return '';
    }
    if (!defConfig.thousandFun) return '';
    return defConfig.thousandFun(number);
}

function MAX(...args: any[]): number {
    if (Array.isArray(args) && args.length === 0) {
        throw new Error('缺少参数')
    }
    // isNaN(null)的结果为false，Math.min函数认为null=0
    const numArr = args.filter(item => !isNaN(item) && item !== null);
    if (numArr.length === 0) {
        throw new Error('必须至少包含一个数值类型的参数');
    }
    return Math.max(...numArr);
}

function MIN(...args: any[]): number {
    if (Array.isArray(args) && args.length === 0) {
        throw new Error('缺少参数')
    }
    // isNaN(null)的结果为false，Math.min函数认为null=0
    const numArr = args.filter(item => !isNaN(item) && item !== null);
    if (numArr.length === 0) {
        throw new Error('必须至少包含一个数值类型的参数');
    }
    return Math.min(...numArr);
}

function TOCAPITAL(number): string {
    if (number === undefined || number === null || number === '') {
        return '';
    }

    try {
        if (isNaN(number)) {
            return '';
        }

        const digit = [
            '零', '壹', '贰', '叁', '肆',
            '伍', '陆', '柒', '捌', '玖'
        ];
        const unit = [
            ['', '万', '亿'],
            ['', '拾', '佰', '仟']
        ];
        const head = number < 0 ? '负' : '';
        const splitArr = number.toString().split('.');

        let integerNum = null;
        let decimalNum = null;
        let integerChinese = '';
        let decimalChinese = '';
        if (splitArr.length > 2) {
            return '';
        } else if (splitArr.length === 2) {
            integerNum = splitArr[0];
            decimalNum = splitArr[1];
        } else {
            integerNum = splitArr[0];
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
            const digitMap = {0: '零', 1: '壹', 2: '贰', 3: '叁', 4: '肆', 5: '伍', 6: '陆', 7: '柒', 8: '捌', 9: '玖'};
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
 * 返回{@param text}中，从{@param startPoint}开始的第一个{@param targetText}的位置
 * @param targetText 目标字符串
 * @param text 原始字符串
 * @param startPoint 起始位置
 * @constructor
 * @return 位置下标，从0开始，未找到返回-1
 */
function FIND(targetText: string, text: string, startPoint: number): number {
    const item = [{'key': targetText}, {'key': text}, {'key': startPoint}];
    const result = item.filter(i => (i.key === undefined || i.key === '' || i.key === null));
    if (result.length > 0) {
        return 0;
    }
    targetText = targetText.toString();
    text = text.toString();
    if (startPoint > text.length) {
        return 0;
    }
    const subStrtext = text.substring(startPoint, text.length);
    if (subStrtext.indexOf(targetText) === -1) {
        return 0;
    }
    return startPoint + subStrtext.indexOf(targetText);
}

/**
 * 判断field是否包含在options中，并且支持字符串部分匹配
 * @param options
 * @param field
 * @constructor
 */
function CONTAINS(options: string[], field: string): boolean {
    return options.some((option) => field.includes(option));
}

/**
 * 将strNum转化为数字
 * @param strNum
 * @constructor
 */
function TONUMBER(strNum: string): number {
    if (strNum === undefined || strNum === '' || strNum === null) {
        return 0;
    }
    const result = Number(strNum);
    return isNaN(result) ? 0 : result;
}

function SLICE(text: string, startPoint: number, length: number): string {
    text = text.toString();
    const item = [{'key': text}, {'key': startPoint}, {'key': length}];
    const result = item.filter(i => (i.key === undefined || i.key === '' || i.key === null));
    if (result.length > 0) {
        return '';
    }
    if (startPoint > text.length || text.length < startPoint + length) {
        return '';
    }
    return text.slice(startPoint, startPoint + length);
}

function ID_TO_AGE(idCard: string): number | undefined {
    if (idCard === undefined || idCard === '' || idCard === null) {
        return undefined;
    }
    idCard = idCard.toString();
    const len = idCard.length;
    if (!(len === 15 || len === 18)) {
        return undefined;
    }
    const birth = idCard.length === 18 ? idCard.slice(6, 14) : idCard.slice(6, 12);
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
        return undefined;
    }
    if (isNaN(month) || isNaN(day) || month > 12 || month === 0 || day > 31 || day === 0) {
        return undefined;
    }
    const date = new Date();
    const currentTimestamp = date.getTime();

    const currentYear = date.getFullYear();
    const birthDay = currentYear + '-' + `${month}-${day}`;
    const birthdayTimestamp = new Date(birthDay).getTime();
    let old = 0;
    if ((currentYear - year) > 0) {
        ((birthdayTimestamp < currentTimestamp)) ? (old = currentYear - year) :
            (old = currentYear - year - 1)
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
        throw new Error('非法的参数类型：' + typeof date)
    }
    const result = _dateFromAny(date);
    const weekDay = result.getDay();
    if (return_type === 1) {
        return weekDay + 1
    } else if (return_type === 2) {
        return weekDay === 0 ? 7 : weekDay;
    } else if (return_type === 3) {
        return (weekDay + 6) % 7
    }
    return weekDay;// 0-6 从星期日开始
}

function DATEVALUE(text: string | number | Date): string {
    if (text === undefined || text === '' || text === null) {
        return '';
    }
    const result = _dateFromAny(text);
    if (!result || isNaN(result.getTime())) {
        return '';
    }
    try {
        const time = new Date(result.getTime());
        const year = time.getFullYear();
        const month = time.getMonth() + 1;
        const day = time.getDate();
        return year + '年' + month + '月' + day + '日';
    } catch (e) {
        return '';
    }
}

function CURRENT_OWNER(): User {
    if (!defConfig.superiors) return;
    const user = defConfig.superiors();
    return {
        code: user.code,
        name: user.name,
        metaName: user.metaName,
        toString() {
            return this.name;
        }
    };
}

export default {
    calculate: _calculate,
    calculateFast: _calculateFast,
    analyze: _analyze,
    setConfig,
    setThousandFun,
    funcMap: _DefaultExpressionFuncs
};
