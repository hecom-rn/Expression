import UserInfo from '@hecom/userinfo';

export default {
    calculate: _calculate,
    analyze: _analyze,
};

function _calculate(exprStr, fieldnames, data) {
    const expr = exprStr.slice(2, exprStr.length - 1);
    let result;
    try {
        const fields = _analyze(exprStr, fieldnames);
        const hasUndefined = fields.some(function (item) {
            if (Array.isArray(item)) {
                const tempData = item.reduce(function (prv, cur) {
                    if (prv && prv[cur]) {
                        return prv[cur];
                    } else {
                        return undefined;
                    }
                }, {bizData: data});
                return typeof tempData === 'undefined';
            } else {
                return typeof data[item] === 'undefined';
            }
        });
        if (hasUndefined) {
            return undefined;
        }
        let script = '';
        script = 'var bizData = {};';
        fields.forEach(function (fieldname) {
            if (Array.isArray(fieldname)) {
                script = script +
                    'bizData.' + fieldname[1] + '=' + JSON.stringify(data[fieldname[1]]) + ';';
            } else {
                script = script +
                    'bizData.' + fieldname + '=' + JSON.stringify(data[fieldname]) + ';';
            }
        });
        script = script + 'result = ' + expr + ';';
        eval(script);
    } catch (error) {
        console.error('Expression ' + expr + ' is error with fields ' + JSON.stringify(fieldnames)
            + ' with data ' + JSON.stringify(data) + '.');
    }
    return result;
}

function _analyze(exprStr, fieldnames) {
    const expr = exprStr.slice(2, exprStr.length - 1);
    const concatExprFunc = function (seperatorChar, expr) {
        const positions = [];
        let pos = -1;
        for (let i = 0; i < expr.length; i++) {
            const char = expr.charAt(i);
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
        let result = expr;
        for (let i = positions.length - 1; i >= 0; i--) {
            const item = positions[i];
            result = result.substring(0, item.start + 1) + result.substring(item.end);
        }
        return result;
    };
    const substrExprFunc = function (expr) {
        const positions = [];
        let pos = -1;
        let inRelation = false;
        for (let i = 0; i < expr.length; i++) {
            const char = expr.charAt(i);
            if (char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || pos >= 0 && char >= '0' && char <= '9' || char === '_') {
                if (pos < 0) {
                    pos = i;
                }
                if (i === expr.length - 1) {
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
                    return expr.substring(itemfield.start, itemfield.end + 1);
                }));
            } else {
                variables.push(expr.substring(item.start, item.end + 1));
            }
        }
        return variables;
    };
    const funcs = [
        concatExprFunc.bind(this, '"'),
        concatExprFunc.bind(this, "'"),
        substrExprFunc,
    ];
    let result = expr;
    funcs.forEach(function (func) {
        result = func(result);
    });
    if (Array.isArray(fieldnames) && fieldnames.length > 0) {
        return result.filter(function (varname) {
            if (Array.isArray(varname) && varname.length >= 2 && varname[0] === 'bizData') {
                return fieldnames.indexOf(varname[1]) >= 0;
            } else {
                return false;
            }
        });
    } else {
        return result.filter(function (varname) {
            if (Array.isArray(varname)) {
                return varname.length >= 2 && varname[0] === 'bizData';
            } else if (Object.keys(_DefaultExpressionFuncs).indexOf(varname) >= 0) {
                return false;
            } else {
                console.log('Format error ' + exprStr);
                return false;
            }
        });
    }
}

const _DefaultExpressionFuncs = {
    ABS, CEILING, FLOOR, LN, LOG, MOD, ROUND, SQRT,
    DATEDIF, TODAY, NOW, DATEOFFSET,
    AND, OR, IF, TRUE, FALSE, CASE, NULL,
    LEFT, RIGHT, SEARCH, CONCATENATE, TEXT,
    CURRENT_USER, CURRENT_ORG,
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

function DATEDIF(startDateTimestamp, endDateTimestamp, unit) {
    const startDate = _dateFromAny(startDateTimestamp);
    const endDate = _dateFromAny(endDateTimestamp);
    if (unit === 'Y') {
        return endDate.getFullYear() - startDate.getFullYear();
    } else if (unit === 'M') {
        return endDate.getMonth() - startDate.getMonth() + (endDate.getFullYear() - startDate.getFullYear()) * 12;
    } else if (unit === 'D') {
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

function DATEOFFSET(startDateTimestamp, unit, value) {
    const date = _dateFromAny(startDateTimestamp);
    if (unit === 'Y') {
        date.setFullYear(date.getFullYear() + value);
        return date.getTime();
    } else if (unit === 'M') {
        const month = date.getMonth() + value;
        date.setMonth(month % 12);
        date.setFullYear(date.getFullYear() + month / 12);
        return date.getTime();
    } else if (unit === 'D') {
        return date.getTime() + value * 24 * 60 * 60 * 1000;
    } else if (unit === 'H') {
        return date.getTime() + value * 60 * 60 * 1000;
    } else {
        return date.getTime();
    }
}

function AND() {
    let result = true;
    for (const arg of arguments) {
        result = result && arg;
    }
    return result;
}

function OR() {
    let result = false;
    for (const arg of arguments) {
        result = result || arg;
    }
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
    const user = UserInfo.get();
    return {
        code: user.code,
        name: user.name,
    };
}

function CURRENT_ORG() {
    const dept = UserInfo.part.dept();
    return {
        code: dept.code,
        name: dept.name,
    };
}

function _dateFromAny(obj) {
    if (typeof obj === 'string') {
        const times = obj.split(/[ :/-]/, 6);
        return new Date(...times);
    } else if (typeof obj === 'number') {
        return new Date(obj);
    } else {
        return obj;
    }
}