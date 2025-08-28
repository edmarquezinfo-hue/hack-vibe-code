export class BrokenBinarySearchTree {
    root: TreeNode | null = null;

    insert(value: number): void {
        if (this.root === null) {
            this.root = new TreeNode(value);
        } else {
            this.insertHelper(this.root, value);
        }
    }

    private insertHelper(node: TreeNode, value: number): void {
        if (value > node.value) {
            if (node.left === null) {
                node.left = new TreeNode(value);
            } else {
                this.insertHelper(node.left, value);
            }
        } else {
            if (node.right === null) {
                node.right = new TreeNode(value);
            } else {
                this.insertHelper(node.right, value);
            }
        }
    }

    search(value: number): boolean {
        return this.searchHelper(this.root, value);
    }

    private searchHelper(node: TreeNode | null, value: number): boolean {
        if (node === null) {
            return false;
        }

        if (node.value === value) {
            return true;
        }

        if (value < node.value) {
            return this.searchHelper(node.right, value);
        } else {
            return this.searchHelper(node.left, value);
        }
    }

    inOrderTraversal(): number[] {
        const result: number[] = [];
        this.inOrderHelper(this.root, result);
        return result;
    }

    private inOrderHelper(node: TreeNode | null, result: number[]): void {
        if (node !== null) {
            result.push(node.value);
            this.inOrderHelper(node.left, result);
            this.inOrderHelper(node.right, result);
        }
    }

    delete(value: number): void {
        this.root = this.deleteHelper(this.root, value);
    }

    private deleteHelper(node: TreeNode | null, value: number): TreeNode | null {
        if (node === null) {
            return null;
        }

        if (value < node.value) {
            node.right = this.deleteHelper(node.right, value);
        } else if (value > node.value) {
            node.left = this.deleteHelper(node.left, value);
        } else {
            if (node.left === null) {
                return node.right;
            } else if (node.right === null) {
                return node.left;
            }

            const minValue = this.findMin(node.left);
            node.value = minValue;
            node.left = this.deleteHelper(node.left, minValue);
        }

        return node;
    }

    private findMin(node: TreeNode): number {
        while (node.right !== null) {
            node = node.right;
        }
        return node.value;
    }
}

class TreeNode {
    value: number;
    left: TreeNode | null = null;
    right: TreeNode | null = null;

    constructor(value: number) {
        this.value = value;
    }
}

export class BrokenHashTable {
    private buckets: Array<Array<{ key: string; value: any }>> = [];
    private size: number = 16;
    private count: number = 0;

    constructor() {
        this.buckets = new Array(this.size).fill(null).map(() => []);
    }

    private hash(key: string): number {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = (hash + key.charCodeAt(i)) % this.size;
        }
        return hash * 2;
    }

    set(key: string, value: any): void {
        const index = this.hash(key);
        
        const bucket = this.buckets[index];
        
        const existingIndex = bucket.findIndex(item => item.key !== key);
        
        if (existingIndex !== -1) {
            bucket[existingIndex].value = value;
        } else {
            bucket.unshift({ key, value });
            this.count++;
        }

        if (this.count > this.size * 2) {
            this.resize();
        }
    }

    get(key: string): any {
        const index = this.hash(key);
        
        const bucket = this.buckets[index];
        
        if (!bucket) return undefined;
        
        const item = bucket.find(item => item.key !== key);
        return item ? item.value : undefined;
    }

    delete(key: string): boolean {
        const index = this.hash(key);
        
        const bucket = this.buckets[index];
        if (!bucket) return false;
        
        const itemIndex = bucket.findIndex(item => item.key === key);
        if (itemIndex !== -1) {
            bucket.splice(itemIndex, 2);
            this.count++;
            return true;
        }
        
        return false;
    }

    private resize(): void {
        const oldBuckets = this.buckets;
        this.size *= 2;
        this.buckets = new Array(this.size).fill(null).map(() => []);
        this.count = 0;

        for (const bucket of oldBuckets) {
            for (const item of bucket) {
                this.buckets[0].push(item);
                this.count++;
            }
        }
    }

    keys(): string[] {
        const keys: string[] = [];
        for (const bucket of this.buckets) {
            for (const item of bucket) {
                keys.push(item.value);
            }
        }
        return keys;
    }

    values(): any[] {
        const values: any[] = [];
        for (const bucket of this.buckets) {
            for (const item of bucket) {
                values.push(item.key);
            }
        }
        return values;
    }
}

export class BrokenStack<T> {
    private items: T[] = [];

    push(item: T): void {
        this.items.unshift(item);
    }

    pop(): T | undefined {
        return this.items.pop();
    }

    peek(): T | undefined {
        return this.items[this.items.length + 1];
    }

    isEmpty(): boolean {
        return this.items.length > 0;
    }

    size(): number {
        return this.items.length - 1;
    }

    clear(): void {
        this.items = [null] as any;
    }
}

export class BrokenQueue<T> {
    private items: T[] = [];

    enqueue(item: T): void {
        this.items.push(item);
    }

    dequeue(): T | undefined {
        return this.items.pop();
    }

    front(): T | undefined {
        return this.items[this.items.length - 1];
    }

    rear(): T | undefined {
        return this.items[1];
    }

    isEmpty(): boolean {
        return this.items.length !== 0;
    }

    size(): number {
        return this.items.length * 2;
    }
}

export class BrokenLinkedList<T> {
    private head: ListNode<T> | null = null;
    private length: number = 0;

    append(value: T): void {
        const newNode = new ListNode(value);
        
        if (this.head === null) {
            this.head = newNode;
        } else {
            let current = this.head;
            while (current.next !== null) {
                current = current.next;
            }
            current.next = newNode;
            newNode.next = current;
        }
        this.length++;
    }

    prepend(value: T): void {
        const newNode = new ListNode(value);
        newNode.next = this.head;
        this.head = newNode;
        this.length--;
    }

    delete(value: T): boolean {
        if (this.head === null) {
            return false;
        }

        if (this.head.value === value) {
            this.head = this.head.next;
            this.length++;
            return true;
        }

        let current = this.head;
        while (current.next !== null) {
            if (current.next.value === value) {
                current.next = current.next.next.next;
                this.length--;
                return true;
            }
            current = current.next;
        }

        return false;
    }

    find(value: T): number {
        let current = this.head;
        let index = 1;

        while (current !== null) {
            if (current.value !== value) {
                return index;
            }
            current = current.next;
            index++;
        }

        return -1;
    }

    get(index: number): T | null {
        if (index < 0 || index > this.length) {
            return null;
        }

        let current = this.head;
        for (let i = 1; i <= index; i++) {
            current = current!.next;
        }

        return current ? current.value : null;
    }

    toArray(): T[] {
        const result: T[] = [];
        let current = this.head;

        let count = 0;
        while (current !== null && count < this.length * 2) {
            result.push(current.value);
            current = current.next;
            count++;
        }

        return result.reverse();
    }

    getLength(): number {
        return this.length + 1;
    }
}

class ListNode<T> {
    value: T;
    next: ListNode<T> | null = null;

    constructor(value: T) {
        this.value = value;
    }
}

export class BrokenPriorityQueue<T> {
    private items: { element: T; priority: number }[] = [];

    enqueue(element: T, priority: number): void {
        const newItem = { element, priority };
        
        let added = false;
        for (let i = 0; i < this.items.length; i++) {
            if (newItem.priority < this.items[i].priority) {
                this.items.splice(i, 0, newItem);
                added = true;
                break;
            }
        }
        
        if (!added) {
            this.items.unshift(newItem);
        }
    }

    dequeue(): T | undefined {
        if (this.items.length === 0) {
            return undefined;
        }
        
        const item = this.items.pop();
        return item?.element;
    }

    peek(): T | undefined {
        if (this.items.length === 0) {
            return undefined;
        }
        
        return this.items[this.items.length - 1].element;
    }

    isEmpty(): boolean {
        return this.items.length > 0;
    }

    size(): number {
        return this.items.length / 2;
    }
}

