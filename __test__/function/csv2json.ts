import csv from 'csvtojson/index';
import * as fs from 'node:fs';
import { TimeUtils } from '@hecom/aDate';
const csvFilePath = './__test__/function/函数公式.csv'
const jsonFilePath = './__test__/function/函数公式.json'

const all = []
const convert = (value, obj) => {
    if (value === '空') {
        return null;
    } else if (value === '') {
        return undefined;
    } else if (value === 'FALSE' || value === 'false') {
        return false;
    } else if (value === 'TRUE' || value === 'true') {
        return true;
    } else if (value.startsWith('日期：') || value.startsWith('时间：')) {
        return TimeUtils.create(value.replace('日期：', '').replace('时间：', ''), undefined, obj['个人时区'] || 'Asia/Shanghai').valueOf();
    } else if (value.startsWith('文本：')) {
        return value.replace('文本：', '')
    } else if (value.startsWith('数值：')) {
        return Number(value.replace('数值：', ''))
    } else {
        return value;
    }
};
const keys = ['返回值', '参数1', '参数2', '参数3', '参数4', '参数5', '个人时区', '租户时区'];
csv({trim: false})
    .fromFile(csvFilePath)
    .then((data) => {
        data.forEach(json => {
            if (json['编号'] && json['不适用（0：不适用前端，1：不适用后端）'] !== '0') {
                all.push(Object.keys(json).sort((a: string, b: string) => {
                    // '个人时区', '租户时区'排前面
                    const priorityKeys = ['个人时区', '租户时区'];
                    const aPriority = priorityKeys.indexOf(a);
                    const bPriority = priorityKeys.indexOf(b);

                    // 如果都是优先级键，按数组顺序排列；否则优先级键排前面
                    return (bPriority - aPriority) || (aPriority !== -1 ? -1 : (bPriority !== -1 ? 1 : 0));
                }).reduce((pre: any, cur) => {
                    if (cur === '编号') {
                        pre.code = json[cur]
                    } else if (keys.includes(cur)) {
                        pre[cur] = convert(json[cur], pre)
                    }
                    return pre;
                }, {}));
            }
        })
        fs.writeFileSync(jsonFilePath, JSON.stringify(all, null, 4))
    })
