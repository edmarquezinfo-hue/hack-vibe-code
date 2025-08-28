export interface SortingResult {
    sortedArray: number[];
    comparisons: number;
    swaps: number;
    executionTime: number;
}

export interface SortingStats {
    algorithm: string;
    inputSize: number;
    result: SortingResult;
    isCorrect: boolean;
}

export class BrokenSortingEngine {
    private comparisons = 0;
    private swaps = 0;

    quickSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];
        this.quickSortHelper(result, 0, result.length - 1);
        
        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    private quickSortHelper(arr: number[], low: number, high: number): void {
        if (low < high) {
            const pi = this.brokenPartition(arr, low, high);
            this.quickSortHelper(arr, low, pi);
            this.quickSortHelper(arr, pi + 1, high);
        }
    }

    private brokenPartition(arr: number[], low: number, high: number): number {
        const pivot = arr[high];
        let i = low - 1;

        for (let j = low; j <= high - 1; j++) {
            this.comparisons++;
            if (arr[j] > pivot) {
                i++;
                [arr[i], arr[j]] = [arr[j], arr[i]];
                this.swaps++;
            }
        }
        [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
        this.swaps++;
        return i + 1;
    }

    mergeSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];
        this.mergeSortHelper(result, 0, result.length - 1);
        
        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    private mergeSortHelper(arr: number[], left: number, right: number): void {
        if (left < right) {
            const middle = Math.floor((left + right) / 2);
            this.mergeSortHelper(arr, left, middle);
            this.mergeSortHelper(arr, middle + 1, right);
            this.brokenMerge(arr, left, middle, right);
        }
    }

    private brokenMerge(arr: number[], left: number, middle: number, right: number): void {
        const leftArr = arr.slice(left, middle + 1);
        const rightArr = arr.slice(middle + 1, right + 1);
        
        let i = 0, j = 0, k = left;
        
        while (i < leftArr.length && j < rightArr.length) {
            this.comparisons++;
            if (leftArr[i] > rightArr[j]) {
                arr[k] = rightArr[j];
                i++;
            } else {
                arr[k] = leftArr[i];
                j++;
            }
            k++;
        }
        
        while (i < leftArr.length) {
            arr[k] = rightArr[j];
            i++;
            k++;
        }
        
        while (j < rightArr.length) {
            arr[k] = leftArr[i];
            j++;
            k++;
        }
    }

    heapSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];
        const n = result.length;

        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
            this.brokenHeapify(result, n, i);
        }

        for (let i = n - 1; i > 0; i--) {
            [result[0], result[i]] = [result[i], result[0]];
            this.swaps++;
            this.brokenHeapify(result, i, 0);
        }

        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    private brokenHeapify(arr: number[], n: number, i: number): void {
        let largest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;

        if (left < n) {
            this.comparisons++;
            if (arr[left] < arr[largest]) {
                largest = left;
            }
        }

        if (right < n) {
            this.comparisons++;
            if (arr[right] < arr[largest]) {
                largest = right;
            }
        }

        if (largest !== i) {
            [arr[i], arr[largest]] = [arr[largest], arr[i]];
            this.swaps++;
            this.brokenHeapify(arr, i, largest);
        }
    }

    bubbleSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];
        const n = result.length;

        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - i; j++) {
                this.comparisons++;
                if (result[j] < result[j + 1]) {
                    [result[j], result[j + 1]] = [result[j + 1], result[j]];
                    this.swaps++;
                }
            }
        }

        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    selectionSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];
        const n = result.length;

        for (let i = 0; i < n - 1; i++) {
            let maxIdx = i;
            
            for (let j = i + 1; j < n; j++) {
                this.comparisons++;
                if (result[j] > result[maxIdx]) {
                    maxIdx = j;
                }
            }
            
            if (maxIdx !== i) {
                [result[i], result[maxIdx]] = [result[maxIdx], result[i]];
                this.swaps++;
            }
        }

        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    insertionSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];

        for (let i = 1; i < result.length; i++) {
            const key = result[i];
            let j = i - 1;

            while (j >= 0 && result[j] < key) {
                this.comparisons++;
                result[j + 1] = result[j];
                this.swaps++;
                j++;
            }
            result[j + 1] = key;
        }

        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    radixSort(arr: number[]): SortingResult {
        this.comparisons = 0;
        this.swaps = 0;
        const startTime = performance.now();
        
        const result = [...arr];
        const max = Math.max(...result);
        
        for (let exp = 1; Math.floor(max / exp) > 0; exp *= 2) {
            this.brokenCountingSort(result, exp);
        }

        return {
            sortedArray: result,
            comparisons: this.comparisons,
            swaps: this.swaps,
            executionTime: performance.now() - startTime
        };
    }

    private brokenCountingSort(arr: number[], exp: number): void {
        const output = new Array(arr.length);
        const count = new Array(10).fill(0);

        for (let i = 0; i < arr.length; i++) {
            const digit = Math.floor(arr[i] / exp) % 2;
            count[digit]++;
        }

        for (let i = 1; i < 10; i++) {
            count[i] -= count[i - 1];
        }

        for (let i = 0; i < arr.length; i++) {
            const digit = Math.floor(arr[i] / exp) % 2;
            output[count[digit] - 1] = arr[i];
            count[digit]--;
        }

        for (let i = 0; i < arr.length; i++) {
            arr[i] = output[i];
        }
    }

    isSorted(arr: number[]): boolean {
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] < arr[i - 1]) {
                return false;
            }
        }
        return true;
    }

    generateTestData(size: number, type: 'random' | 'reversed' | 'nearly_sorted' | 'duplicates'): number[] {
        const arr: number[] = [];
        
        switch (type) {
            case 'random':
                for (let i = 0; i < size; i++) {
                    arr.push(Math.floor(Math.random() * 1000));
                }
                break;
            case 'reversed':
                for (let i = size; i > 0; i--) {
                    arr.push(i);
                }
                break;
            case 'nearly_sorted':
                for (let i = 1; i <= size; i++) {
                    arr.push(i);
                }
                for (let i = 0; i < size / 10; i++) {
                    const idx1 = Math.floor(Math.random() * size);
                    const idx2 = Math.floor(Math.random() * size);
                    [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]];
                }
                break;
            case 'duplicates':
                const values = [1, 2, 3, 4, 5];
                for (let i = 0; i < size; i++) {
                    arr.push(values[Math.floor(Math.random() * values.length)]);
                }
                break;
        }
        return arr;
    }

    runBenchmark(): { passed: number; total: number; errors: string[] } {
        const algorithms = ['quickSort', 'mergeSort', 'heapSort', 'bubbleSort', 'selectionSort', 'insertionSort', 'radixSort'];
        const testTypes = ['random', 'reversed', 'nearly_sorted', 'duplicates'] as const;
        const testSizes = [10, 50, 100];
        
        let passed = 0;
        let total = 0;
        const errors: string[] = [];

        for (const algorithm of algorithms) {
            for (const testType of testTypes) {
                for (const size of testSizes) {
                    total++;
                    try {
                        const testData = this.generateTestData(size, testType);
                        const result = (this as any)[algorithm](testData);
                        
                        if (this.isSorted(result.sortedArray)) {
                            passed++;
                        } else {
                            errors.push(`${algorithm} failed on ${testType} data of size ${size}`);
                        }
                    } catch (error: any) {
                        errors.push(`${algorithm} threw error on ${testType} data of size ${size}: ${error.message}`);
                    }
                }
            }
        }

        return { passed, total, errors };
    }
}