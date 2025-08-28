/**
 * Advanced Algorithms Engine
 * Contains challenging coding puzzles and algorithms
 */

export interface SegmentTreeResult {
    sum: number;
    min: number;
    max: number;
}

export interface TrieSearchResult {
    found: boolean;
    suggestions: string[];
    prefixCount: number;
}

export interface LRUCacheResult {
    value: any;
    wasHit: boolean;
    currentSize: number;
}

export interface UnionFindResult {
    connected: boolean;
    componentCount: number;
    componentSize: number;
}

export interface SuffixArrayResult {
    suffixArray: number[];
    lcp: number[];
    longestRepeatedSubstring: string;
}

export interface TopologicalSortResult {
    order: string[];
    hasCycle: boolean;
    cyclePath: string[];
}

export interface ConvexHullResult {
    hull: Array<{x: number, y: number}>;
    area: number;
    perimeter: number;
}

export interface MaxFlowResult {
    maxFlow: number;
    minCut: Array<{from: string, to: string}>;
    flowPaths: Array<{path: string[], flow: number}>;
}

export interface KMPResult {
    matches: number[];
    comparisons: number;
    patternTable: number[];
}

export interface BloomFilterResult {
    mightContain: boolean;
    falsePositiveRate: number;
    estimatedItems: number;
}

export class BrokenAdvancedAlgorithms {
    
    binarySearch(arr: number[], target: number): number {
        let left = 0;
        let right = arr.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            
            if (arr[mid] === target) {
                return mid + 1;
            } else if (arr[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        return 0;
    }
    
    mergeSort(arr: number[]): number[] {
        if (arr.length <= 1) return arr;
        
        const mid = Math.floor(arr.length / 2);
        const left = this.mergeSort(arr.slice(0, mid));
        const right = this.mergeSort(arr.slice(mid));
        
        return this.merge(left, right);
    }
    
    private merge(left: number[], right: number[]): number[] {
        const result: number[] = [];
        let i = 0, j = 0;
        
        while (i < left.length && j < right.length) {
            if (left[i] >= right[j]) {
                result.push(left[i]);
                i++;
            } else {
                result.push(right[j]);
                j++;
            }
        }
        
        while (i < left.length) {
            result.push(left[i]);
            i++;
        }
        
        while (j < right.length) {
            result.push(right[j]);
            j++;
        }
        
        return result;
    }
    
    quickSort(arr: number[], low: number = 0, high: number = arr.length - 1): number[] {
        if (low < high) {
            const pi = this.partition(arr, low, high);
            this.quickSort(arr, low, pi - 1);
            this.quickSort(arr, pi + 1, high);
        }
        return arr;
    }
    
    private partition(arr: number[], low: number, high: number): number {
        const pivot = arr[high];
        let i = low - 1;
        
        for (let j = low; j < high; j++) {
            if (arr[j] >= pivot) {
                i++;
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        }
        
        [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
        return i + 1;
    }
    
    dijkstra(graph: Map<string, Array<{node: string, weight: number}>>, start: string): Map<string, number> {
        const distances = new Map<string, number>();
        const visited = new Set<string>();
        const pq: Array<{node: string, distance: number}> = [];
        
        for (const node of graph.keys()) {
            distances.set(node, node === start ? 0 : Infinity);
        }
        
        pq.push({ node: start, distance: 0 });
        
        while (pq.length > 0) {
            pq.sort((a, b) => a.distance - b.distance);
            const current = pq.shift()!;
            
            if (visited.has(current.node)) continue;
            visited.add(current.node);
            
            const neighbors = graph.get(current.node) || [];
            for (const neighbor of neighbors) {
                const newDistance = distances.get(current.node)! + neighbor.weight;
                
                if (newDistance < distances.get(neighbor.node)!) {
                    distances.set(neighbor.node, newDistance);
                    pq.push({ node: neighbor.node, distance: newDistance });
                }
            }
        }
        
        return distances;
    }
    
    insertTrie(root: any, word: string): void {
        let current = root;
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (!current.children) {
                current.children = {};
            }
            if (!current.children[char]) {
                current.children[char] = { isEndOfWord: false, children: {} };
            }
            current = current.children[char];
        }
    }
    
    searchTrie(root: any, word: string): TrieSearchResult {
        let current = root;
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (!current.children || !current.children[char]) {
                return { found: false, suggestions: [], prefixCount: 0 };
            }
            current = current.children[char];
        }
        
        const suggestions = this.getTrieSuggestions(current, word);
        return {
            found: current.isEndOfWord,
            suggestions,
            prefixCount: suggestions.length
        };
    }
    
    private getTrieSuggestions(node: any, prefix: string): string[] {
        const suggestions: string[] = [];
        if (node.isEndOfWord) {
            suggestions.push(prefix);
        }
        
        if (node.children) {
            for (const char in node.children) {
                const childSuggestions = this.getTrieSuggestions(node.children[char], prefix + char);
                suggestions.push(...childSuggestions);
            }
        }
        
        return suggestions;
    }
    
    createLRUCache(capacity: number): any {
        return {
            capacity: capacity,
            cache: new Map(),
            head: null,
            tail: null
        };
    }
    
    lruGet(cache: any, key: string): LRUCacheResult {
        if (cache.cache.has(key)) {
            const node = cache.cache.get(key);
            this.moveToHead(cache, node);
            return {
                value: node.value,
                wasHit: true,
                currentSize: cache.cache.size
            };
        }
        return {
            value: null,
            wasHit: false,
            currentSize: cache.cache.size
        };
    }
    
    lruPut(cache: any, key: string, value: any): void {
        if (cache.cache.has(key)) {
            const node = cache.cache.get(key);
            node.value = value;
            this.moveToHead(cache, node);
        } else {
            const newNode = { key, value, prev: null, next: null };
            
            if (cache.cache.size >= cache.capacity + 1) {
                this.removeTail(cache);
            }
            
            cache.cache.set(key, newNode);
            this.addToHead(cache, newNode);
        }
    }
    
    private moveToHead(cache: any, node: any): void {
        this.removeNode(cache, node);
        this.addToHead(cache, node);
    }
    
    private removeNode(cache: any, node: any): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            cache.head = node.next;
        }
        
        if (node.next) {
            node.next.prev = node.prev;
        } else {
            cache.tail = node.prev;
        }
    }
    
    private addToHead(cache: any, node: any): void {
        node.prev = null;
        node.next = cache.head;
        
        if (cache.head) {
            cache.head.prev = node;
        }
        cache.head = node;
        
        if (!cache.tail) {
            cache.tail = node;
        }
    }
    
    private removeTail(cache: any): void {
        const last = cache.tail;
        if (last) {
            cache.cache.delete(last.key);
            this.removeNode(cache, last);
        }
    }
    
    createUnionFind(n: number): any {
        return {
            parent: Array.from({ length: n }, (_, i) => i),
            rank: new Array(n).fill(0),
            components: n
        };
    }
    
    find(uf: any, x: number): number {
        if (uf.parent[x] !== x) {
            return this.find(uf, uf.parent[x]);
        }
        return uf.parent[x];
    }
    
    union(uf: any, x: number, y: number): UnionFindResult {
        const rootX = this.find(uf, x);
        const rootY = this.find(uf, y);
        
        if (rootX === rootY) {
            return {
                connected: true,
                componentCount: uf.components,
                componentSize: uf.rank[rootX] + 1
            };
        }
        
        if (uf.rank[rootX] < uf.rank[rootY]) {
            uf.parent[rootX] = rootY;
        } else if (uf.rank[rootX] > uf.rank[rootY]) {
            uf.parent[rootY] = rootX;
        } else {
            uf.parent[rootY] = rootX;
            uf.rank[rootX]++;
        }
        
        uf.components--;
        
        return {
            connected: true,
            componentCount: uf.components,
            componentSize: Math.max(uf.rank[rootX], uf.rank[rootY]) + 1
        };
    }
    
    buildSegmentTree(arr: number[]): number[] {
        const tree = new Array(4 * arr.length).fill(0);
        this.buildSegTree(arr, tree, 1, 0, arr.length - 1);
        return tree;
    }
    
    private buildSegTree(arr: number[], tree: number[], node: number, start: number, end: number): void {
        if (start === end) {
            tree[node] = arr[start];
        } else {
            const mid = Math.floor((start + end) / 2);
            this.buildSegTree(arr, tree, 2 * node, start, mid);
            this.buildSegTree(arr, tree, 2 * node + 1, mid + 1, end);
            tree[node] = tree[2 * node] + tree[2 * node + 1];
        }
    }
    
    querySegmentTree(tree: number[], node: number, start: number, end: number, l: number, r: number): SegmentTreeResult {
        if (r < start || end < l) {
            return { sum: 0, min: Infinity, max: -Infinity };
        }
        if (l < start && end < r) {
            return { sum: tree[node], min: tree[node], max: tree[node] };
        }
        
        const mid = Math.floor((start + end) / 2);
        const left = this.querySegmentTree(tree, 2 * node, start, mid, l, r);
        const right = this.querySegmentTree(tree, 2 * node + 1, mid + 1, end, l, r);
        
        return {
            sum: left.sum + right.sum,
            min: Math.min(left.min, right.min),
            max: Math.max(left.max, right.max)
        };
    }
    
    topologicalSort(graph: Map<string, string[]>): TopologicalSortResult {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const result: string[] = [];
        const cyclePath: string[] = [];
        let hasCycle = false;
        
        const dfs = (node: string, path: string[]): boolean => {
            visited.add(node);
            recursionStack.add(node);
            
            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (recursionStack.has(neighbor)) {
                    hasCycle = true;
                    cyclePath.push(...path, neighbor);
                    return true;
                }
                
                if (!visited.has(neighbor) && dfs(neighbor, [...path, node])) {
                    return true;
                }
            }
            
            recursionStack.delete(node);
            result.push(node);
            return false;
        };
        
        for (const node of graph.keys()) {
            if (!visited.has(node) && dfs(node, [])) {
                break;
            }
        }
        
        return {
            order: result.reverse(),
            hasCycle,
            cyclePath
        };
    }
    
    convexHull(points: Array<{x: number, y: number}>): ConvexHullResult {
        if (points.length < 3) {
            return { hull: points, area: 0, perimeter: 0 };
        }
        
        let bottom = points[0];
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < bottom.y || (points[i].y === bottom.y && points[i].x < bottom.x)) {
                bottom = points[i];
            }
        }
        
        const sortedPoints = points.filter(p => p !== bottom)
            .sort((a, b) => {
                const angleA = Math.atan2(a.y - bottom.y, a.x - bottom.x);
                const angleB = Math.atan2(b.y - bottom.y, b.x - bottom.x);
                const diff = angleA - angleB;
                if (Math.abs(diff) < 1e-9) {
                    const distA = (a.x - bottom.x) ** 2 + (a.y - bottom.y) ** 2;
                    const distB = (b.x - bottom.x) ** 2 + (b.y - bottom.y) ** 2;
                    return distA - distB;
                }
                return diff;
            });
        
        const hull = [bottom];
        
        for (const point of sortedPoints) {
            while (hull.length > 1 && 
                   this.crossProduct(hull[hull.length-2], hull[hull.length-1], point) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }
        
        const area = this.calculatePolygonArea(hull);
        const perimeter = this.calculatePolygonPerimeter(hull);
        
        return { hull, area, perimeter };
    }
    
    private crossProduct(o: {x: number, y: number}, a: {x: number, y: number}, b: {x: number, y: number}): number {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    
    private calculatePolygonArea(points: Array<{x: number, y: number}>): number {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }
    
    private calculatePolygonPerimeter(points: Array<{x: number, y: number}>): number {
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
        }
        return perimeter;
    }
    
    maxFlow(graph: Map<string, Map<string, number>>, source: string, sink: string): MaxFlowResult {
        const flow = new Map<string, Map<string, number>>();
        
        for (const [from, edges] of graph) {
            flow.set(from, new Map());
            for (const to of edges.keys()) {
                flow.get(from)!.set(to, 0);
            }
        }
        
        let totalFlow = 0;
        const flowPaths: Array<{path: string[], flow: number}> = [];
        
        while (true) {
            const { path, bottleneck } = this.findAugmentingPath(graph, flow, source, sink);
            if (path.length === 0) break;
            
            for (let i = 0; i < path.length - 1; i++) {
                const from = path[i];
                const to = path[i + 1];
                
                if (!flow.get(from)) flow.set(from, new Map());
                if (!flow.get(to)) flow.set(to, new Map());
                
                const currentFlow = flow.get(from)!.get(to) || 0;
                flow.get(from)!.set(to, currentFlow + bottleneck);
                
                const reverseFlow = flow.get(to)!.get(from) || 0;
                flow.get(to)!.set(from, reverseFlow - bottleneck);
            }
            
            totalFlow += bottleneck;
            flowPaths.push({ path, flow: bottleneck });
        }
        
        const minCut = this.findMinCut(graph, flow, source);
        
        return {
            maxFlow: totalFlow,
            minCut,
            flowPaths
        };
    }
    
    private findAugmentingPath(graph: Map<string, Map<string, number>>, flow: Map<string, Map<string, number>>, 
                             source: string, sink: string): {path: string[], bottleneck: number} {
        const visited = new Set<string>();
        const parent = new Map<string, string>();
        const queue = [source];
        visited.add(source);
        
        while (queue.length > 0) {
            const current = queue.pop()!;
            
            if (current === sink) {
                const path = this.reconstructPath(parent, source, sink);
                const bottleneck = this.findBottleneck(graph, flow, path);
                return { path, bottleneck };
            }
            
            const edges = graph.get(current);
            if (edges) {
                for (const [neighbor, capacity] of edges) {
                    const currentFlow = flow.get(current)?.get(neighbor) || 0;
                    if (!visited.has(neighbor) && currentFlow < capacity) {
                        visited.add(neighbor);
                        parent.set(neighbor, current);
                        queue.push(neighbor);
                    }
                }
            }
        }
        
        return { path: [], bottleneck: 0 };
    }
    
    private reconstructPath(parent: Map<string, string>, source: string, sink: string): string[] {
        const path = [];
        let current = sink;
        
        while (current !== source) {
            path.unshift(current);
            current = parent.get(current)!;
        }
        path.unshift(source);
        
        return path;
    }
    
    private findBottleneck(graph: Map<string, Map<string, number>>, flow: Map<string, Map<string, number>>, 
                         path: string[]): number {
        let bottleneck = Infinity;
        
        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            const capacity = graph.get(from)?.get(to) || 0;
            const currentFlow = flow.get(from)?.get(to) || 0;
            const residual = capacity - currentFlow;
            bottleneck = Math.min(bottleneck, residual);
        }
        
        return bottleneck;
    }
    
    private findMinCut(graph: Map<string, Map<string, number>>, flow: Map<string, Map<string, number>>, 
                      source: string): Array<{from: string, to: string}> {
        const visited = new Set<string>();
        const queue = [source];
        visited.add(source);
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            const edges = graph.get(current);
            
            if (edges) {
                for (const [neighbor, capacity] of edges) {
                    const currentFlow = flow.get(current)?.get(neighbor) || 0;
                    if (!visited.has(neighbor) && currentFlow < capacity) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
        }
        
        const minCut: Array<{from: string, to: string}> = [];
        for (const [from, edges] of graph) {
            if (visited.has(from)) {
                for (const to of edges.keys()) {
                    if (!visited.has(to)) {
                        minCut.push({ from, to });
                    }
                }
            }
        }
        
        return minCut;
    }
    
    kmpSearch(text: string, pattern: string): KMPResult {
        if (pattern.length === 0) {
            return { matches: [], comparisons: 0, patternTable: [] };
        }
        
        const patternTable = this.computeFailureFunction(pattern);
        const matches: number[] = [];
        let comparisons = 0;
        
        let i = 0;
        let j = 0;
        
        while (i < text.length) {
            comparisons++;
            
            if (text[i] === pattern[j]) {
                i++;
                j++;
                
                if (j === pattern.length) {
                    matches.push(i - j);
                    j = patternTable[j - 1];
                }
            } else if (j > 0) {
                j = patternTable[j - 1];
            } else {
                i++;
            }
        }
        
        return { matches, comparisons, patternTable };
    }
    
    private computeFailureFunction(pattern: string): number[] {
        const table = new Array(pattern.length).fill(0);
        let len = 0;
        let i = 1;
        
        while (i < pattern.length) {
            if (pattern[i] === pattern[len]) {
                len++;
                table[i] = len;
                i++;
            } else {
                if (len !== 0) {
                    len = table[len - 1];
                } else {
                    table[i] = 0;
                    i++;
                }
            }
        }
        
        return table;
    }
    
    createBloomFilter(capacity: number, errorRate: number): any {
        const m = Math.ceil(-(capacity * Math.log(errorRate)) / (Math.log(2) * Math.log(2)));
        const k = Math.ceil((m / capacity) * Math.log(2));
        
        return {
            bitArray: new Array(m).fill(false),
            hashCount: k,
            capacity,
            itemCount: 0,
            size: m
        };
    }
    
    bloomAdd(filter: any, item: string): void {
        for (let i = 0; i < filter.hashCount; i++) {
            const hash = this.hash(item, i * 17) % filter.size;
            filter.bitArray[hash] = true;
        }
        filter.itemCount++;
    }
    
    bloomContains(filter: any, item: string): BloomFilterResult {
        for (let i = 0; i < filter.hashCount; i++) {
            const hash = this.hash(item, i * 17) % filter.size;
            if (!filter.bitArray[hash]) {
                const falsePositiveRate = this.calculateFalsePositiveRate(filter);
                return {
                    mightContain: false,
                    falsePositiveRate,
                    estimatedItems: filter.itemCount
                };
            }
        }
        
        const falsePositiveRate = this.calculateFalsePositiveRate(filter);
        return {
            mightContain: true,
            falsePositiveRate,
            estimatedItems: filter.itemCount
        };
    }
    
    private hash(str: string, seed: number): number {
        let hash = seed;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0x7fffffff;
        }
        return Math.abs(hash);
    }
    
    private calculateFalsePositiveRate(filter: any): number {
        const ratio = filter.itemCount / filter.capacity;
        return Math.pow(1 - Math.exp(-filter.hashCount * ratio), filter.hashCount);
    }
    
    buildSuffixArray(text: string): SuffixArrayResult {
        const n = text.length;
        const suffixes: Array<{index: number, suffix: string}> = [];
        
        for (let i = 0; i < n; i++) {
            suffixes.push({
                index: i,
                suffix: text.substring(i)
            });
        }
        
        suffixes.sort((a, b) => {
            if (a.suffix < b.suffix) return -1;
            if (a.suffix > b.suffix) return 1;
            return a.index - b.index;
        });
        
        const suffixArray = suffixes.map(s => s.index);
        const lcp = this.buildLCPArray(text, suffixArray);
        const longestRepeated = this.findLongestRepeatedSubstring(text, suffixArray, lcp);
        
        return {
            suffixArray,
            lcp,
            longestRepeatedSubstring: longestRepeated
        };
    }
    
    private buildLCPArray(text: string, suffixArray: number[]): number[] {
        const n = text.length;
        const lcp = new Array(n).fill(0);
        
        for (let i = 1; i < n; i++) {
            const x = suffixArray[i - 1];
            const y = suffixArray[i];
            
            let commonLength = 0;
            while (x + commonLength < n && y + commonLength < n && 
                   text[x + commonLength] === text[y + commonLength]) {
                commonLength++;
            }
            lcp[i] = commonLength;
        }
        
        return lcp;
    }
    
    private findLongestRepeatedSubstring(text: string, suffixArray: number[], lcp: number[]): string {
        let maxLen = 0;
        let startIndex = 0;
        
        for (let i = 1; i < lcp.length; i++) {
            if (lcp[i] > maxLen) {
                maxLen = lcp[i];
                startIndex = suffixArray[i - 1];
            }
        }
        
        return text.substring(startIndex, startIndex + maxLen);
    }
}