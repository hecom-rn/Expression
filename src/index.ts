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
}

let defConfig: Config = {};

export default {
    calculate: _calculate,
    analyze: _analyze,
    setConfig,
};

function setConfig(config: Config) {
    Object.assign(defConfig, config);
}

/**
 * 计算表达式的值，返回计算结果。
 * @param exprStr 表达式，必须是"${...}"格式
 * @param fieldnames 表达式中应该包含哪些字段名称，不传的话，则所有不是函数的都是字段名称
 * @param data 业务对象的数据
 */
function _calculate(exprStr: string, fieldnames?: string[], data?): any {
    const expr = exprStr.slice(2, exprStr.length - 1);
    let result; // eslint-disable-line init-declarations
    try {
        const fields = _analyze(exprStr, fieldnames);
        let script = 'var bizData = {};';
        fields.forEach(function (fieldname) {
            script = script + 'bizData.' + fieldname[1] + '=' + JSON.stringify(data[fieldname[1]]) + ';';
        });
        script = script + 'result = ' + expr + ';';
        eval(script);
    } catch (error) {
        console.warn('Expression', expr, 'is error with fields', JSON.stringify(fieldnames), 'with data', JSON.stringify(data) + '.');
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
    ABS, CEILING, FLOOR, LN, LOG, MOD, ROUND, SQRT,
    TIMEDIF, DATEDIF, TODAY, NOW, DATEOFFSET, TIMEOFFSET,
    AND, OR, IF, TRUE, FALSE, CASE, NULL,
    LEFT, RIGHT, SEARCH, CONCATENATE, TEXT,
    CURRENT_USER, CURRENT_ORG, TO_CAPITAL_RMB
};

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
    return Date.now();
}

function NOW() {
    return Date.now();
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

function LEFT(fieldId, numberChars) {
    return fieldId.substring(0, numberChars);
}

function RIGHT(fieldId, numberChars) {
    return fieldId.substring(fieldId.length - numberChars, fieldId.length);
}

function SEARCH(fieldId, keyword) {
    return fieldId.indexOf(keyword) !== -1;
}

function CONCATENATE() {
    return Array.prototype.join.call(arguments, '');
}

function TEXT(value) {
    return '' + value;
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