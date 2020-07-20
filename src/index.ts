export type AnalyzeResult = string[];

interface User {
    code: string
    name: string
    dept: {
        code: string
        name: string
    }
}

interface Config {
    currentUser?: () => User
    eval?: (expr: string, bizData: object) => any
    superiors?: () => User
}

let defConfig: Config = {};
let defThousandFun = null;

function setConfig(config: Config) {
    Object.assign(defConfig, config);
}

function setThousandFun(thousandFun: Function) {
    defThousandFun = thousandFun;
}

/**
 * 计算表达式的值，返回计算结果。
 * @param exprStr 表达式，必须是"${...}"格式
 * @param fieldnames 表达式中应该包含哪些字段名称，不传的话，则所有不是函数的都是字段名称
 * @param data 业务对象的数据
 * @param useNull 使用null代替undefined的计算结果
 * @param throwException 计算失败时是否抛出异常
 */
function _calculate(exprStr: string, fieldnames?: string[], data?, {useNull = false, throwException = false} = {}): any {
    const expr = exprStr.slice(2, exprStr.length - 1);
    let result;
    try {
        const bizData = Object.assign({}, data);
        if (defConfig.eval) {
            result = defConfig.eval(expr, bizData)
        } else {
            result = eval(expr);
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
    TIMEDIF, DATEDIF, TODAY, NOW, DATEOFFSET, TIMEOFFSET, DAY, MONTH, YEAR, TODATE, DATEVALUE,
    // 逻辑函数
    AND, OR, IF, TRUE, FALSE, CASE, NULL, ISNOTNULL, ISNULL,
    // 文本函数
    LEFT, RIGHT, SEARCH, CONCATENATE, TEXT, TOCAPITAL, TO_CAPITAL_RMB, FIND, SLICE, ID_TO_AGE, TONUMBER,
    CURRENT_USER, CURRENT_ORG, CURRENT_OWNER
};

function ISNOTNULL(value) {
    return !(value === null);
}

function ISNULL(value) {
    return value === null;
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
    const startDate = _dateFromAny(startDateTimestamp);
    const endDate = _dateFromAny(endDateTimestamp);
    if (unit === 'Y' || unit === 'y') {
        return endDate.getFullYear() - startDate.getFullYear();
    } else if (unit === 'M') {
        return endDate.getMonth() - startDate.getMonth() + (endDate.getFullYear() - startDate.getFullYear()) * 12;
    } else if (unit === 'D' || unit === 'd') {
        return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    } else if (unit === 'MD') {
        return endDate.getDate() - startDate.getDate();
    } else if (unit === 'YM') {
        return endDate.getMonth() - startDate.getMonth();
    } else if (unit === 'YD') {
        startDate.setFullYear(1970);
        endDate.setFullYear(1970);
        return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    } else {
        return 0;
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
    return DATEOFFSET(startTimestamp, unit, value)
}

function DATEOFFSET(startDateTimestamp, unit, value) {
    const date = _dateFromAny(startDateTimestamp);
    if (unit === 'Y' || unit === 'y') {
        date.setFullYear(date.getFullYear() + value);
        return date.getTime();
    } else if (unit === 'M') {
        const month = date.getMonth() + value;
        date.setMonth(month % 12);
        date.setFullYear(date.getFullYear() + month / 12);
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
        if (condition === value || String(condition) === String(value)) {
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
    };
}

function CURRENT_ORG() {
    if (!defConfig.currentUser) return;
    const {dept} = defConfig.currentUser();
    return {
        code: dept.code,
        name: dept.name,
    };
}

function _dateFromAny(obj) {
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
        const date = new Date(Date.parse(year + '-' + month + '-' + day));
        const result = date.getTime();
        if (result > 0) {
            return result;
        }
    } catch (e) {
        throw 'error';
    }
}

function THOUSANDSEP(number) {
    if (number === undefined || number === '' || number === null || isNaN(number)) {
        return '';
    }
    if (!defThousandFun) return '';
    return defThousandFun(number);
}


function MAX(...args: any[]) {
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


function MIN(...args: any[]) {
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

function TOCAPITAL(number) {
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
                    cycle = digit[integerNum % 10] + unit[1][j] + cycle;
                    integerNum = Math.floor(integerNum / 10);
                }
                integerChinese = cycle.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + integerChinese;
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

function FIND(targetText, text, startPoint) {
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

function TONUMBER(strNum) {
    if (strNum === undefined || strNum === '' || strNum === null || isNaN(strNum)) {
        return '';
    }
    return Number(strNum);
}


function SLICE(text, startPoint, length) {
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

function ID_TO_AGE(idCard) {
    if (idCard === undefined || idCard === '' || idCard === null) {
        return '';
    }
    idCard = idCard.toString();
    const len = idCard.length;
    if (!(len === 15 || len === 18)) {
        return '';
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
        return '';
    }
    if (isNaN(month) || isNaN(day) || month > 12 || month === 0 || day > 31 || day === 0) {
        return '';
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

function DATEVALUE(text) {
    if (text === undefined || text === '' || text === null) {
        return '';
    }
    const result = _dateFromAny(text);
    if (isNaN(result)) {
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

function CURRENT_OWNER() {
    if (!defConfig.superiors) return;
    const user = defConfig.superiors();
    return {
        code: user.code,
        name: user.name,
    };
}

export default {
    calculate: _calculate,
    analyze: _analyze,
    setConfig,
    setThousandFun,
    funcMap: _DefaultExpressionFuncs
};
