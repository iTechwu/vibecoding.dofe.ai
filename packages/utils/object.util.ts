import validate from './validate.util';
import jsonUtil from './json.util';
import { pick } from 'lodash';

type NestedObject = {
  [key: string]: NestedObject | {};
};
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default {
  filter<T extends object>(object: T, fields: string[]) {
    return pick(object, fields);
  },
  getType(data: unknown): string {
    if (Array.isArray(data)) return 'array';
    if (data === null) return 'null';
    return typeof data;
  },
  isCustomType(object: unknown, constructorName: string): boolean {
    return Boolean(
      object &&
      typeof object === 'object' &&
      typeof object.constructor === 'function' &&
      object.constructor.name === constructorName,
    );
  },
  getValue<T = unknown>(data: unknown, name: string, defaultValue: T | null = null): T | null {
    const objData = typeof data === 'string' ? jsonUtil.parse(data, defaultValue) : data;
    if (this.getType(name) !== 'string') return defaultValue;
    if (this.getType(objData) !== 'object' || objData === null) return defaultValue;

    if (name.includes('.')) {
      return name.split('.').reduce((acc, key) => {
        return acc !== defaultValue ? this.getValue(acc, key, defaultValue) : defaultValue;
      }, objData as unknown) as T | null;
    } else {
      const record = objData as UnknownRecord;
      return Object.prototype.hasOwnProperty.call(record, name) && validate.isNotBlank(record[name])
        ? (record[name] as T)
        : defaultValue;
    }
  },
  addProperty<T extends UnknownRecord>(obj: unknown, key: string, value: unknown): T {
    const addObj: UnknownRecord = {};
    addObj[key] = value;
    const baseObj = isRecord(obj) ? obj : {};
    const nextObj = {
      ...baseObj,
      ...addObj,
    };
    return nextObj as T;
  },
  removeProperty<T extends UnknownRecord>(obj: T, key: string): Partial<T> {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      return obj;
    }
    const newObj: Partial<T> = { ...obj };
    delete newObj[key as keyof T];
    return newObj;
  },
  removePropertys<T extends UnknownRecord>(obj: T, keys: string[]): Partial<T> {
    return keys.reduce<Partial<T>>((acc, key) => this.removeProperty(acc as T, key), obj);
  },
  // 数组的项目是Object的处理
  addPropertyInArray<T extends UnknownRecord>(array: unknown[], key: string, value: unknown): T[] {
    return array
      .filter((item) => this.isCustomType(item, 'Object'))
      .map((item) => this.addProperty(item, key, value) as T);
  },
  removePropertysInArray<T extends UnknownRecord>(array: T[], keys: string[]): (Partial<T> | T)[] {
    return array.map((item) => this.removePropertys(item, keys));
  },
  setNestedValue(obj: UnknownRecord, path: string, value: unknown): void {
    // 将字符串路径转换为路径数组
    const pathArray = path.split('.');

    // 确保路径数组不为空
    if (pathArray.length === 0) {
      throw new Error('Path cannot be an empty string.');
    }

    // 遍历路径数组，除了最后一个元素
    for (let i = 0; i < pathArray.length - 1; i++) {
      const key = pathArray[i];
      if (!key) continue;

      // 如果当前层的字段不存在，则创建它（假设它是一个对象）
      if (!Object.prototype.hasOwnProperty.call(obj, key) || !isRecord(obj[key])) {
        obj[key] = {};
      }

      // 向下遍历到下一层对象
      obj = obj[key] as UnknownRecord;
    }
    // 设置最后一个字段的值
    const lastKey = pathArray[pathArray.length - 1];
    if (lastKey) {
      obj[lastKey] = value;
    }
  },

  traverseKeys(obj: NestedObject | unknown, parentKeys: string[] = []): string[][] {
    const keyPaths: string[][] = [];
    if (!isRecord(obj)) return keyPaths;

    // 遍历对象的每一个属性
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // 构建当前键的完整路径
        const currentKeys = [...parentKeys, key];

        // 添加到key路径数组中
        keyPaths.push(currentKeys);

        // 如果值是对象，则递归遍历
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          // 递归调用并合并返回的key路径
          keyPaths.push(...this.traverseKeys(obj[key], currentKeys));
        }
      }
    }

    return keyPaths;
  },
  isEqual(object1: unknown, object2: unknown): boolean {
    if (object1 === object2) {
      return true;
    }
    if (!object1 || !object2) {
      return false;
    }
    if (!isRecord(object1) || !isRecord(object2)) {
      return false;
    }
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
      return false;
    }
    for (const key of keys1) {
      const val1 = object1[key];
      const val2 = object2[key];
      if (typeof val1 === 'object' && typeof val2 === 'object') {
        if (!this.isEqual(val1, val2)) {
          return false;
        }
      } else if (val1 !== val2) {
        return false;
      }
    }
    return true;
  },
};
