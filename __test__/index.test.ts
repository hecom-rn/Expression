import Expression, { Config, FuncTypeMap } from '../src/index';
import { advanceTo, clear } from 'jest-date-mock';
import Sval, { SvalOptions } from "sval";
import jexl from 'jexl';
import { TimeUtils } from '@hecom/aDate';

function expression(content: string, data?: any) {
    // return Expression.calculate('${' + content + '}', fieldNames, data);
    return Expression.calculateFast(content, data);
}

class Proxy {
    __key__: string;

    constructor(obj: object, key: string) {
        Object.keys(obj).forEach(k => {
            this[k] = obj[k];
        });
        this.__key__ = key;
    }

    toString() {
        return this[this.__key__]
    }
}

const MetaName = {
    User: 'user',
    Dept: 'dept'
}
const user = {
    code: '123',
    name: 'test',
    metaName: MetaName.User,
    owner: { code: '234', name: 'parent', metaName: MetaName.User },
    dept: { code: '2', name: 'testDept', metaName: MetaName.Dept }
};

function initExpression() {
    const callbackFuncMap: Config = {
        currentUser: () => user,
        thousandFun: (num) => {
            num = Math.round(num);
            return (num + '').replace(/(\d{1,3})(?=(\d{3})+(?:$|\.))/g, '$1,');
        },
    };
    Expression.setConfig(callbackFuncMap);
    initSval();
}

function initSval() {
    const options = {
        ecmaVer: 6,
        sandBox: true,
        nullSafe: true,
        operatorHandle: [
            {
                name: '+',
                handle(left, right) {
                    const typeL = typeof left;
                    const typeR = typeof right;
                    if (typeL !== 'number' && typeR !== 'number') {
                        if (left === null || left === undefined) {
                            left = '';
                        }
                        if (right === null || right === undefined) {
                            right = '';
                        }
                    }
                    if (typeL === 'object' && left.valueOf) {
                        left = left.toString();
                    }
                    if (typeR === 'object' && right.valueOf) {
                        right = right.toString();
                    }
                    return left + right;
                },
            },
        ],
    } as SvalOptions;
    const interpreter = new Sval(options);
    interpreter.import(Expression.funcMap);
    Expression.setConfig({
        eval: (expr, bizData, { null2Zero, otherVars }) => {
            interpreter.import({ bizData, ...otherVars });
            interpreter.run(`exports.result=${expr}`, { null2Zero, funcTypeMap: FuncTypeMap });
            return interpreter.exports.result;
        },
    });
}

function initJexl() {
    jexl.addFunctions(Expression.funcMap);
    Expression.setConfig({
        eval: (expr, bizData, { null2Zero, otherVars }) => {
            return jexl.evalSync(expr, { bizData, ...otherVars });
        },
    });
}

describe('多变量测试', () => {
    beforeAll(initExpression);
    it('多变量测试', () => {
        // eslint-disable-next-line no-template-curly-in-string
        const result = Expression.calculate('${bizData.a + other.b + c.d}', [], { a: 1 },
            { otherVars: { other: { b: 1 }, c: { d: 1 } } })
        expect(result).toEqual(3)
    })
    it('未传多变量参数', () => {
        // eslint-disable-next-line no-template-curly-in-string
        const result = Expression.calculate('${bizData.a + bizData.b + bizData.d}', [], { a: 1, b: 1, d: 1 })
        expect(result).toEqual(3)
    })
})

/**
 * 函数相关的表达式测试用例
 */
describe('formula', () => {
    beforeAll(initExpression);
    test('CONTAINS', () => {
        const options = `['option1', 'option3']`;
        const field = 'option1'
        let result = expression(`CONTAINS(${options}, '${field}')`)
        expect(result).toBeTruthy()
        const field2 = 'option2'
        result = expression(`CONTAINS(${options}, '${field2}')`)
        expect(result).toBeFalsy()
    });
    test('ABS', () => {
        const f = function (count) {
            const result = expression(`ABS(${count})`);
            expect(result).toBe(Math.abs(count))
        };
        f(5);
        f(-5);
    });
    test('CEILINT', () => {
        const count = 1.5;
        const result = expression(`CEILING(${count})`);
        expect(result).toBe(Math.ceil(count))
    });
    test('FLOOR', () => {
        const count = 5.5;
        const result = expression(`FLOOR(${count})`);
        expect(result).toBe(Math.floor(count))
    });
    test('LN', () => {
        const count = 5.5;
        const result = expression(`LN(${count})`);
        expect(result).toBe(1.7047481);
    });
    test('LOG', () => {
        const count = 5.5;
        const result = expression(`LOG(${count})`);
        expect(result).toBe(0.7403627);
    });
    test('MOD', () => {
        const count = 5.5;
        const divisor = 2;
        const result = expression(`MOD(${count}, ${divisor})`);
        expect(result).toBe(count % divisor);
    });
    test('ROUND', () => {
        const count = 5.538;
        const divisor = 2;
        const result = expression(`ROUND(${count}, ${divisor})`);
        expect(result).toBe(5.54);
    });
    test('SQRT', () => {
        const count = 5.538;
        const result = expression(`SQRT(${count})`);
        expect(result).toBe(2.3532956);
    });
    test('AND', () => {
        const result = expression(`AND(1, true, 0)`);
        expect(result).toBeFalsy()
    });
    test('OR', () => {
        const result = expression(`OR(true,FALSE())`);
        expect(result).toBeTruthy();
    });

    it('IF', () => {
        const data = [[0, 2, 1, 1], [1, 2, 1, 2], [false, 1, 3, 3], [true, 4, 2, 4], [null, 1, 5, 5], [undefined, 1, 6, 6], ["{}", 7, 2, null], ['[]', 1, 8, null],]
        data.forEach(([logicalTest, valueIfTrue, valueIfFalse, r]) => {
            const result = expression(`IF(${logicalTest},${valueIfTrue},${valueIfFalse})`);
            expect(result).toEqual(r);
        })
    })

    test('ISNOTNULL', () => {
        const truthy = [true, 12, 0, false, "{}", "'0'"];
        truthy.forEach(item => {
            const result = expression(`ISNOTNULL(${item})`);
            expect(result).toBeTruthy();
        });
        const falsy = [null, '""', undefined, []]
        falsy.forEach(item => {
            const result = expression(`ISNOTNULL(${item})`);
            expect(result).toBeFalsy();
        })
    });
    test('ISNULL', () => {
        const falsy = ['true', '12', '0', 'false', '{}'];
        falsy.forEach(item => {
            const result = expression(`ISNULL(${item})`);
            expect(result).toBeFalsy();
        });
        const truthy = [null, "''", undefined, '[]', 'NaN']
        truthy.forEach(item => {
            const result = expression(`ISNULL(${item})`);
            expect(result).toBeTruthy();
        })
    });

    test('TIMEDIF', () => {
        const dif = 4832894;
        const start = TimeUtils.create().valueOf();
        let end = start + dif;
        const units = ['h', 'm', 's'];
        units.forEach(unit => {
            const result = expression(`TIMEDIF(${start}, ${end}, "${unit}")`);
            const div = unit === 'h' ? 1000 * 3600 : unit === 'm' ? 1000 * 60 : 1000;
            expect(result).toBe(Math.floor(dif / div))
        });
        end = start - dif;
        units.forEach(unit => {
            const result = expression(`TIMEDIF(${start}, ${end}, "${unit}")`);
            const div = unit === 'h' ? 1000 * 3600 : unit === 'm' ? 1000 * 60 : 1000;
            expect(result).toBe(Math.ceil(-dif / div))
        })
    });

    test('CURRENT_USER', () => {
        const result = expression(`CURRENT_USER()`);
        expect(result.code).toBe(user.code);
        expect(result.name).toBe(user.name);
        expect(result.metaName).toBe(user.metaName);
    });

    test('CURRENT_ORG', () => {
        const result = expression(`CURRENT_ORG()`);
        expect(result.code).toBe(user.dept.code);
        expect(result.name).toBe(user.dept.name);
        expect(result.metaName).toBe(user.dept.metaName);
    });

    test('CURRENT_OWNER', () => {
        const result = expression(`CURRENT_OWNER()`);
        expect(result.code).toBe(user.owner.code);
        expect(result.name).toBe(user.owner.name);
        expect(result.metaName).toBe(user.owner.metaName);
    })

    test('TO_CAPITAL_RMB', () => {
        const moneyArr = [
            { key: 0.0, value: '零元整' },
            { key: 123456789000.123, value: '壹仟贰佰叁拾肆亿伍仟陆佰柒拾捌万玖仟元壹角贰分' },
            { key: 88776699.55, value: '捌仟捌佰柒拾柒万陆仟陆佰玖拾玖元伍角伍分' },
            { key: '"88异常测试99"', value: null },
            { key: '"987654.12"', value: '玖拾捌万柒仟陆佰伍拾肆元壹角贰分' },
            { key: 33449.74, value: '叁万叁仟肆佰肆拾玖元柒角肆分' },
            { key: 33449, value: '叁万叁仟肆佰肆拾玖元整' },
        ];
        moneyArr.forEach(item => {
            const result = expression(`TO_CAPITAL_RMB(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('TODAY', () => {
        const result = expression(`TODAY()`);
        expect(Math.ceil(result / 1000) * 1000).toBe(result);
    });

    test('NOW', () => {
        const result = expression(`NOW()`);
        expect(Math.ceil(result / 1000) * 1000).toBe(result);
    });

    test('DAY', () => {
        const dateArr = [
            { key: '"2019-10-10"', value: 10 },
            { key: '"2019/12/15"', value: 15 },
            { key: '"异常测试"', value: null },
            { key: null, value: null },
            { key: undefined, value: null }
        ];
        dateArr.forEach(item => {
            const result = expression(`DAY(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('MONTH', () => {
        const dateArr = [
            { key: '"2019-1-10"', value: 1 },
            { key: '"2019/12/15"', value: 12 },
            { key: '"异常测试"', value: null },
            { key: null, value: null },
            { key: undefined, value: null }
        ];
        dateArr.forEach(item => {
            const result = expression(`MONTH(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('YEAR', () => {
        const dateArr = [
            { key: '"2019-1-10"', value: 2019 },
            { key: '"1990/12/15"', value: 1990 },
            { key: '"异常测试"', value: null },
            { key: '', value: null },
            { key: null, value: null },
            { key: undefined, value: null }
        ];
        dateArr.forEach(item => {
            const result = expression(`YEAR(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('TODATE', () => {
        const dateArr = [
            { key: [2019, 12, 1], value: TimeUtils.create('2019-12-1').valueOf() },
            { key: [1990, 1, 1], value: TimeUtils.create('1990-1-1').valueOf() },
            { key: ['"异常测试"', '"嘻嘻"', '"哈哈"'], value: null },
            { key: [undefined, 9, 27], value: null },
            { key: [9012, '""', 27], value: null },
            { key: [9876, 9, null], value: null },
        ];
        dateArr.forEach(item => {
            const result = expression(`TODATE(${item.key[0]}, ${item.key[1]}, ${item.key[2]})`);
            expect(result).toBe(item.value);
        });
    });

    it('DATEOFFSET', () => {
        const date = TimeUtils.create('2022-01-06').valueOf();
        const testData = [
            { date, unit: 'Y', value: -3, result: '2019-01-06' },
            { date, unit: 'y', value: 3, result: '2025-01-06' },
            { date, unit: 'M', value: -3, result: '2021-10-06' },
            { date, unit: 'm', value: 3, result: '2022-04-06' },
            { date, unit: 'D', value: -13, result: '2021-12-24' },
            { date, unit: 'd', value: 13, result: '2022-01-19' },
            { date, unit: 'H', value: -11, result: '2022-01-05 13:00:00' },
            { date: undefined, unit: 'h', value: 3, result: null },
            { date: undefined, unit: 'h', value: '3', result: null },
            { date, unit: 'y', value: '3', result: '2025-01-06' },
            { date, value: 3, result: null },
        ]
        testData.forEach(item => {
            const result = !item.value ? expression(`DATEOFFSET(${item.date},'${item.unit}',)`) :
                !item.date ? expression(`DATEOFFSET(,'${item.unit}',${item.value})`) :
                    !item.unit ? expression(`DATEOFFSET(${item.date},,${item.value})`) :
                        expression(`DATEOFFSET(${item.date},'${item.unit}',${item.value})`);
            if (result === undefined) {
                expect(result).toBe(item.result);
            } else {
                expect(result).toBe(item.result ? TimeUtils.create(item.result).valueOf() : item.result);
            }

        });

        // 补充月份边界
        const date1 = TimeUtils.create('2022-03-31').valueOf();
        const testData1 = [
            { date: date1, unit: 'M', value: -2, result: '2022-01-31' },
            { date: date1, unit: 'M', value: 1, result: '2022-04-30' },
            { date: date1, unit: 'M', value: 2, result: '2022-05-31' },
            { date: date1, unit: 'M', value: 6, result: '2022-09-30' },
            { date: date1, unit: 'M', value: 12, result: '2023-03-31' },
        ]
        testData1.forEach(item => {
            const result = expression(`DATEOFFSET(${item.date},'${item.unit}',${item.value})`);
            expect(result).toBe(item.result ? TimeUtils.create(item.result).valueOf() : item.result);
        });
    })

    it('TIMEOFFSET', () => {
        const date = TimeUtils.create('2022-01-06 08:00:00').valueOf();
        const testData = [
            { date, unit: 'H', value: -11, result: '2022-01-05 21:00:00' },
            { date, unit: 'h', value: 3, result: '2022-01-06 11:00:00' },
            { date, unit: 'M', value: -3, result: '2022-01-06 07:57:00' },
            { date, unit: 'm', value: 3, result: '2022-01-06 08:03:00' },
            { date, unit: 'S', value: -34, result: '2022-01-06 07:59:26' },
            { date, unit: 's', value: 34, result: '2022-01-06 08:00:34' },
            { date, unit: 'h', value: 3, result: '2022-01-06 11:00:00' },
            { date, unit: 'h', result: null },
            { date: undefined, unit: 'h', value: 3, result: null },
            { date: undefined, unit: 'h', value: '3', result: null },
            { date, unit: 'h', value: '3', result: '2022-01-06 11:00:00' },
            { date, value: 3, result: null },
        ]
        testData.forEach(item => {
            const result = !item.value ? expression(`TIMEOFFSET(${item.date},'${item.unit}',)`) :
                !item.date ? expression(`TIMEOFFSET(,'${item.unit}',${item.value})`) :
                    !item.unit ? expression(`TIMEOFFSET(${item.date},,${item.value})`) :
                        expression(`TIMEOFFSET(${item.date},'${item.unit}',${item.value})`);
            if (result === undefined) {
                expect(result).toBe(item.result);
            } else {
                console.log(item.value, item.result,)
                expect(result).toBe(item.result ? TimeUtils.create(item.result).valueOf() : item.result);
            }
        });
    })

    test('THOUSANDSEP', () => {
        const dateArr = [
            { key: 12340.789, value: '12,341' },
            { key: 123456, value: '123,456' },
            { key: 123, value: '123' },
            { key: 1, value: '1' },
            { key: '"异常测试"', value: null },
            { key: undefined, value: null },
        ];
        dateArr.forEach(item => {
            const result = expression(`THOUSANDSEP(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('MAX', () => {
        const dateArr = [
            { key: [-23, -45, -90, -61235, -3214, -6123599], value: -23 },
            { key: [23, 45, 90, 61235, 0, 3214, -6123599], value: 61235 },
            { key: [23, 45, 90, 61235, 0, 'undefined', 61235], value: 61235 },
            { key: [-23, -45, -90, -61235, -3214, 'null'], value: -23 },
            { key: [23, 45, 90, 61235, 0, 3214, '"异常测试"'], value: 61235 },
        ];
        dateArr.forEach(item => {
            const result = expression(`MAX(${item.key})`);
            expect(result).toBe(item.value);
        });
        try {
            expression(`MAX()`);
        } catch (e) {
            expect(e.message).toBe('缺少参数');
        }
        try {
            expression(`MAX(null, '123')`);
        } catch (e) {
            expect(e.message).toBe('必须至少包含一个数值类型的参数');
        }
    });

    test('FirstNotNull', () => {
        try {
            expression(`FirstNotNull()`);
        } catch (e) {
            expect(e.message).toBe('缺少参数');
        }

        const dateArr = [
            { key: [-23, 0], value: -23 },
            { key: ['""', '1', 'undefined', 0, 3214, -6123599], value: 1 },
            { key: ['[]', 90, 'undefined', 0, 'undefined', 61235], value: 90 },
            { key: ['""', '[]', 'undefined', 'null'], value: null },
            { key: ['NaN', '120'], value: 120 },
        ];
        dateArr.forEach(item => {
            const result = expression(`FirstNotNull(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('MIN', () => {
        const dateArr = [
            { key: [23, 45, 90, 61235, 0, 3214], value: 0 },
            { key: [23, 45, 90, '"字符串"', 0, 3214, -1], value: -1 },
            { key: [23, 45, 'null', 61235, 3214, 0.9], value: 0.9 },
            { key: [23, 45, 90, 'undefined', 0, 3214, -2], value: -2 },
        ];
        dateArr.forEach(item => {
            const result = expression(`MIN(${item.key})`);
            expect(result).toBe(item.value);
        });
        try {
            expression(`MIN()`);
        } catch (e) {
            expect(e.message).toBe('缺少参数');
        }
        try {
            expression(`MIN(null, '123')`);
        } catch (e) {
            expect(e.message).toBe('必须至少包含一个数值类型的参数');
        }
    });

    test('TOCAPITAL', () => {
        const dateArr = [
            { key: 0, value: '零' },
            { key: 0.9, value: '零点玖' },
            { key: 12345, value: '壹万贰仟叁佰肆拾伍' },
            { key: 67897.87, value: '陆万柒仟捌佰玖拾柒点捌柒' },
            { key: 100345, value: '壹拾万零叁佰肆拾伍' },
            { key: 1202345, value: '壹佰贰拾万贰仟叁佰肆拾伍' },
            { key: 201201202345, value: '贰仟零壹拾贰亿零壹佰贰拾万贰仟叁佰肆拾伍' },
            { key: 1023, value: '壹仟零贰拾叁' },
            { key: 10000023, value: '壹仟万零贰拾叁' },
            { key: 1000023, value: '壹佰万零贰拾叁' },
            { key: 1908, value: '壹仟玖佰零捌' },
            { key: 190800, value: '壹拾玖万零捌佰' },
            { key: 190809, value: '壹拾玖万零捌佰零玖' },
            { key: 1090809, value: '壹佰零玖万零捌佰零玖' },
            { key: '"异常测试"', value: null },
        ];
        dateArr.forEach(item => {
            const result = expression(`TOCAPITAL(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('FIND', () => {
        const dateArr = [
            { key: ['"p"', '"applepay"', 4], value: 5 },
            { key: ['"p"', '"applepay"', 9], value: -1 },
            { key: ['"西"', '"applepay"', 9], value: -1 },
        ];
        dateArr.forEach(item => {
            const result = expression(`FIND(${item.key[0]}, ${item.key[1]}, ${item.key[2]})`);
            expect(result).toBe(item.value);
        });
    });

    test('TONUMBER', () => {
        const dateArr = [
            { key: '"209.23"', value: 209.23 },
            { key: '"209"', value: 209 },
            { key: '"异常测试"', value: null },
        ];
        dateArr.forEach(item => {
            const result = expression(`TONUMBER(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('LEFT', () => {
        const params = [
            { item: 123456, length: 3, value: '123' },
            { item: '123456', length: 3, value: '123' },
            { item: new Proxy({ label: 'abcdefg' }, 'label'), length: 3, value: 'abc' },
        ];
        params.forEach(({ item, length, value }) => {
            const result = expression(`LEFT(bizData.item, ${length})`, { item });
            expect(result).toBe(value)
        })
    });
    test('RIGHT', () => {
        const params = [
            { item: 123456, length: 3, value: '456' },
            { item: '123456', length: 3, value: '456' },
            { item: new Proxy({ label: 'abcdefg' }, 'label'), length: 3, value: 'efg' },
        ];
        params.forEach(({ item, length, value }) => {
            const result = expression(`RIGHT(bizData.item, ${length})`, { item });
            expect(result).toBe(value)
        })
    });
    test('SEARCH', () => {
        const params = [
            { item: 123456, key: '456', value: true },
            { item: '123456', key: '456', value: true },
            { item: new Proxy({ label: 'abcdefg' }, 'label'), key: 'efg', value: true },
            { item: new Proxy({ label: 'abcdefg' }, 'label'), key: 'bac', value: false },
            { item: new Proxy({ label: 'abcdefg' }, 'label'), key: new Proxy({ key: 'efg' }, 'key'), value: true },
        ];
        params.forEach(({ item, key, value }) => {
            const result = expression(`SEARCH(bizData.item, bizData.key)`, { item, key });
            if (value) {
                expect(result).toBeTruthy();
            } else {
                expect(result).toBeFalsy();
            }
        })
    });

    test('SLICE', () => {
        const dateArr = [
            { key: ['"tomorrow"', 3, 2], value: 'or' },
            { key: ['"tomorrow"', 7, 2], value: 'w' },
            { key: ['"tomorrow"', 3, 0], value: '' },
            { key: ['"异常测试"', 9, 2], value: null },
        ];
        dateArr.forEach(item => {
            const result = expression(`SLICE(${item.key[0]}, ${item.key[1]}, ${item.key[2]})`);
            expect(result).toBe(item.value);
        });
    });

    test('ID_TO_AGE', () => {
        advanceTo(TimeUtils.create('2020-02-20T02:03:30.331Z').valueOf());
        const arr = [
            { key: 422324199610271952, value: 23 },
            { key: 110102199209081234, value: 27 },
            { key: 4223241991082719987, value: null }
        ];
        arr.forEach(item => {
            const result = expression(`ID_TO_AGE(${item.key})`);
            expect(result).toBe(item.value);
        });
        clear();
    });

    test('DATEVALUE', () => {
        const dateArr = [
            { key: 1575456374840, value: '2019年12月4日' },
            { key: '"2019-12-4"', value: '2019年12月4日' },
        ];
        dateArr.forEach(item => {
            const result = expression(`DATEVALUE(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('DATEDIF', () => {
        const testData = [
            { startTime: 1604657236000, endTime: 1604830036000, unit: 'd', result: 2 }, // 2020-11-06 18:07:16  2020-11-08 18:07:16
            { startTime: 1604830036000, endTime: 1604837236000, unit: 'd', result: 0 }, // 2020-11-08 18:07:16  2020-11-08 20:07:16
            { startTime: 1604830036000, endTime: 1604657236000, unit: 'd', result: -2 },//2020-11-08 18:07:16   2020-11-06 18:07:16
            { startTime: 1604837236000, endTime: 1604830036000, unit: 'd', result: 0 }, //2020-11-08 20:07:16   2020-11-08 18:07:16
            { startTime: undefined, endTime: 1604830036000, unit: 'd', result: null },     //undefined   2020-11-08 18:07:16
        ];

        testData.forEach(item => {
            const result = expression(`DATEDIF(${item.startTime}, ${item.endTime}, "${item.unit}")`);
            expect(result).toBe(item.result);
        });
    });
    test('WEEKDAY', () => {
        const testData = [
            { date: 1631462400000, result: 2 }, // 2021-9-13
            { date: 1631462400000, type: 1, result: 2 }, // 2021-9-13
            { date: 1631548800000, type: 1, result: 3 }, // 2021-9-14
            { date: 1631635200000, type: 1, result: 4 }, // 2021-9-15
            { date: 1631721600000, type: 1, result: 5 }, // 2021-9-16
            { date: 1631808000000, type: 1, result: 6 }, // 2021-9-17
            { date: 1631894400000, type: 1, result: 7 }, // 2021-9-18
            { date: 1631980800000, type: 1, result: 1 }, // 2021-9-19

            { date: 1631462400000, type: 2, result: 1 }, // 2021-9-13
            { date: 1631548800000, type: 2, result: 2 }, // 2021-9-14
            { date: 1631635200000, type: 2, result: 3 }, // 2021-9-15
            { date: 1631721600000, type: 2, result: 4 }, // 2021-9-16
            { date: 1631808000000, type: 2, result: 5 }, // 2021-9-17
            { date: 1631894400000, type: 2, result: 6 }, // 2021-9-18
            { date: 1631980800000, type: 2, result: 7 }, // 2021-9-19

            { date: 1631462400000, type: 3, result: 0 }, // 2021-9-13
            { date: 1631548800000, type: 3, result: 1 }, // 2021-9-14
            { date: 1631635200000, type: 3, result: 2 }, // 2021-9-15
            { date: 1631721600000, type: 3, result: 3 }, // 2021-9-16
            { date: 1631808000000, type: 3, result: 4 }, // 2021-9-17
            { date: 1631894400000, type: 3, result: 5 }, // 2021-9-18
            { date: 1631980800000, type: 3, result: 6 }, // 2021-9-19
            { date: undefined, result: null },
            { date: null, result: null },
        ];

        testData.forEach(({ date, type, result }) => {
            let expectResult = null;
            if (type) {
                expectResult = expect(expression(`WEEKDAY(${date}, ${type})`));
            } else {
                expectResult = expect(expression(`WEEKDAY(${date})`))
            }
            expectResult.toBe(result)
        });

    })
});

describe('换行符测试', () => {
    beforeAll(initExpression);
    it('字符串内换行', () => {
        let expr = "＄{\"\\n身份证号\\n职位\"}";
        expr = expr.slice(2, expr.length - 1)
        expect(expression(expr)).toEqual('\n身份证号\n职位');
    });
    it('字符串外换行', () => {
        // eslint-disable-next-line no-template-curly-in-string
        let expr = "${'生日' + \n'身份证号' + \n'职位'}";
        expr = expr.slice(2, expr.length - 1)
        expect(expression(expr)).toEqual('生日身份证号职位');
    });
});
