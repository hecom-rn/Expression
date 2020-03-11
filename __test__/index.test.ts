import Expression from '../src/index';

function expression(content: string, data?: any, fieldNames?: any) {
    return Expression.calculate('${' + content + '}', fieldNames, data);
}

class Proxy {
    __key__: string;

    constructor(obj: object, key: string) {
        Object.keys(obj).forEach(key => {
            this[key] = obj[key];
        });
        this.__key__ = key;
    }

    toString() {
        return this[this.__key__]
    }
}

/**
 * 函数相关的表达式测试用例
 */
describe('formula', () => {
    const user = {code: '123', name: 'test', dept: {code: '2', name: 'testDept'}};
    const callbackFuncMap = {
        currentUser: () => user
    };
    Expression.setConfig(callbackFuncMap);
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
        expect(result).toBe(Math.log(count));
    });
    test('LOG', () => {
        const count = 5.5;
        const result = expression(`LOG(${count})`);
        expect(result).toBe(Math.log10(count));
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
        expect(result).toBe(Math.sqrt(count));
    });
    test('AND', () => {
        const result = expression(`AND(1, true, 0)`);
        expect(result).toBeFalsy()
    });
    test('OR', () => {
        const result = expression(`OR(true,FALSE())`);
        expect(result).toBeTruthy();
    });

    test('ISNOTNULL', () => {
        const params = [true, '', undefined, 12];
        params.forEach(item => {
            const result = expression(`ISNOTNULL(${item})`);
            expect(result).toBeTruthy();
        });
        const result = expression(`ISNOTNULL(null)`);
        expect(result).toBeFalsy();
    });
    test('ISNULL', () => {
        const params = [true, '', undefined, 12];
        params.forEach(item => {
            const result = expression(`ISNULL(${item})`);
            expect(result).toBeFalsy();
        });
        const result = expression(`ISNULL(null)`);
        expect(result).toBeTruthy();
    });

    test('TIMEDIF', () => {
        const dif = 4832894;
        const start = Date.now();
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
    });

    test('TO_CAPITAL_RMB', () => {
        const moneyArr = [
            {key: 0.0, value: '零元整'},
            {key: 123456789000.123, value: '壹仟贰佰叁拾肆亿伍仟陆佰柒拾捌万玖仟元壹角贰分'},
            {key: 88776699.55, value: '捌仟捌佰柒拾柒万陆仟陆佰玖拾玖元伍角伍分'},
            {key: '"88异常测试99"', value: ''},
            {key: '"987654.12"', value: '玖拾捌万柒仟陆佰伍拾肆元壹角贰分'},
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
            {key: '"2019-10-10"', value: 10},
            {key: '"2019/12/15"', value: 15},
            {key: '"异常测试"', value: ''},
            {key: null, value: ''}
        ];
        dateArr.forEach(item => {
            const result = expression(`DAY(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('MONTH', () => {
        const dateArr = [
            {key: '"2019-1-10"', value: 1},
            {key: '"2019/12/15"', value: 12},
            {key: '"异常测试"', value: ''},
            {key: undefined, value: ''}
        ];
        dateArr.forEach(item => {
            const result = expression(`MONTH(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('YEAR', () => {
        const dateArr = [
            {key: '"2019-1-10"', value: 2019},
            {key: '"1990/12/15"', value: 1990},
            {key: '"异常测试"', value: ''},
            {key: '', value: ''}
        ];
        dateArr.forEach(item => {
            const result = expression(`YEAR(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('TODATE', () => {
        const dateArr = [
            {key: [2019, 12, 1], value: new Date('2019-12-1').getTime()},
            {key: [1990, 1, 1], value: new Date('1990-1-1').getTime()},
            {key: ['"异常测试"', '"嘻嘻"', '"哈哈"'], value: 0},
            {key: [undefined, 9, 27], value: 0},
            {key: [9012, '""', 27], value: 0},
            {key: [9876, 9, null], value: 0},
        ];
        dateArr.forEach(item => {
            const result = expression(`TODATE(${item.key[0]}, ${item.key[1]}, ${item.key[2]})`);
            expect(result).toBe(item.value);
        });
    });

    test('THOUSANDSEP', () => {
        Expression.setThousandFun((num) => {
            num = Math.round(num);
            return (num + '').replace(/(\d{1,3})(?=(\d{3})+(?:$|\.))/g, '$1,');
        });

        const dateArr = [
            {key: 12340.789, value: '12,341'},
            {key: 123456, value: '123,456'},
            {key: 123, value: '123'},
            {key: 1, value: '1'},
            {key: '"异常测试"', value: ''},
            {key: undefined, value: ''},
        ];
        dateArr.forEach(item => {
            const result = expression(`THOUSANDSEP(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('MAX', () => {
        const dateArr = [
            {key: [-23, -45, -90, -61235, -3214, -6123599], value: -23},
            {key: [23, 45, 90, 61235, 0, 3214, -6123599], value: 61235},
            {key: [23, 45, 90, 61235, 0, 'undefined', 61235], value: 61235},
            {key: [-23, -45, -90, -61235, -3214, 'null'], value: -23},
            {key: [23, 45, 90, 61235, 0, 3214, '"异常测试"'], value: 61235},
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

    test('MIN', () => {
        const dateArr = [
            {key: [23, 45, 90, 61235, 0, 3214], value: 0},
            {key: [23, 45, 90, '"字符串"', 0, 3214, -1], value: -1},
            {key: [23, 45, 'null', 61235, 3214, 0.9], value: 0.9},
            {key: [23, 45, 90, 'undefined', 0, 3214, -2], value: -2},
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
            {key: 0, value: '零'},
            {key: 0.9, value: '零点玖'},
            {key: 12345, value: '壹万贰仟叁佰肆拾伍'},
            {key: 67897.87, value: '陆万柒仟捌佰玖拾柒点捌柒'},
            {key: '"异常测试"', value: ''},
        ];
        dateArr.forEach(item => {
            const result = expression(`TOCAPITAL(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('FIND', () => {
        const dateArr = [
            {key: ['"p"', '"applepay"', 4], value: 5},
            {key: ['"p"', '"applepay"', 9], value: 0},
            {key: ['"西"', '"applepay"', 9], value: 0},
        ];
        dateArr.forEach(item => {
            const result = expression(`FIND(${item.key[0]}, ${item.key[1]}, ${item.key[2]})`);
            expect(result).toBe(item.value);
        });
    });

    test('TONUMBER', () => {
        const dateArr = [
            {key: '"209.23"', value: 209.23},
            {key: '"209"', value: 209},
            {key: '"异常测试"', value: ''},
        ];
        dateArr.forEach(item => {
            const result = expression(`TONUMBER(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('LEFT', () => {
        const params = [
            {item: 123456, length: 3, value: '123'},
            {item: '123456', length: 3, value: '123'},
            {item: new Proxy({label: 'abcdefg'}, 'label'), length: 3, value: 'abc'},
        ];
        params.forEach(({item, length, value}) => {
            const result = expression(`LEFT(bizData.item, ${length})`, {item});
            expect(result).toBe(value)
        })
    });
    test('RIGHT', () => {
        const params = [
            {item: 123456, length: 3, value: '456'},
            {item: '123456', length: 3, value: '456'},
            {item: new Proxy({label: 'abcdefg'}, 'label'), length: 3, value: 'efg'},
        ];
        params.forEach(({item, length, value}) => {
            const result = expression(`RIGHT(bizData.item, ${length})`, {item});
            expect(result).toBe(value)
        })
    });
    test('SEARCH', () => {
        const params = [
            {item: 123456, key: '456', value: true},
            {item: '123456', key: '456', value: true},
            {item: new Proxy({label: 'abcdefg'}, 'label'), key: 'efg', value: true},
            {item: new Proxy({label: 'abcdefg'}, 'label'), key: 'bac', value: false},
            {item: new Proxy({label: 'abcdefg'}, 'label'), key: new Proxy({key: 'efg'}, 'key'), value: true},
        ];
        params.forEach(({item, key, value}) => {
            const result = expression(`SEARCH(bizData.item, bizData.key)`, {item, key});
            if (value) {
                expect(result).toBeTruthy();
            } else {
                expect(result).toBeFalsy();
            }
        })
    });

    test('SLICE', () => {
        const dateArr = [
            {key: ['"tomorrow"', 3, 2], value: 'or'},
            {key: ['"tomorrow"', 7, 2], value: ''},
            {key: ['"tomorrow"', 3, 0], value: ''},
            {key: ['"异常测试"', 9, 2], value: ''},
        ];
        dateArr.forEach(item => {
            const result = expression(`SLICE(${item.key[0]}, ${item.key[1]}, ${item.key[2]})`);
            expect(result).toBe(item.value);
        });
    });

    test('ID_TO_AGE', () => { //这个期望的值和当前的时间有关系，随着时间的推移，期望的值会越来越大
        const dateArr = [
            {key: 422324199610271952, value: 23},
            {key: 110102199209081234, value: 27},
            {key: 4223241991082719987, value: ''},
        ];
        dateArr.forEach(item => {
            const result = expression(`ID_TO_AGE(${item.key})`);
            expect(result).toBe(item.value);
        });
    });

    test('DATEVALUE', () => {
        const dateArr = [
            {key: 1575456374840, value: '2019年12月4日'},
            {key: '"2019-12-4"', value: '2019年12月4日'},
        ];
        dateArr.forEach(item => {
            const result = expression(`DATEVALUE(${item.key})`);
            expect(result).toBe(item.value);
        });
    });
});
