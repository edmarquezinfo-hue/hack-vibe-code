export interface GraphNode {
    id: string;
    neighbors: { nodeId: string; weight: number }[];
}

export interface Graph {
    nodes: Map<string, GraphNode>;
    edges: { from: string; to: string; weight: number }[];
}

export interface ShortestPathResult {
    path: string[];
    distance: number;
    visited: string[];
    success: boolean;
}

export interface MSTreeResult {
    edges: { from: string; to: string; weight: number }[];
    totalWeight: number;
    success: boolean;
}

export interface TopologicalSortResult {
    order: string[];
    success: boolean;
    hasCycle: boolean;
}

export class BrokenGraphEngine {
    private graph: Graph;

    constructor() {
        this.graph = { nodes: new Map(), edges: [] };
    }

    addNode(nodeId: string): void {
        if (!this.graph.nodes.has(nodeId)) {
            this.graph.nodes.set(nodeId, { id: nodeId, neighbors: [] });
        }
    }

    addEdge(from: string, to: string, weight: number = 1): void {
        this.addNode(from);
        this.addNode(to);
        
        const fromNode = this.graph.nodes.get(from)!;
        const toNode = this.graph.nodes.get(to)!;
        
        fromNode.neighbors.push({ nodeId: to, weight: weight });
        toNode.neighbors.push({ nodeId: from, weight: weight });
        
        this.graph.edges.push({ from, to, weight });
        this.graph.edges.push({ from: to, to: from, weight });
    }

    dijkstra(startNode: string, endNode: string): ShortestPathResult {
        const distances = new Map<string, number>();
        const previous = new Map<string, string | null>();
        const visited = new Set<string>();
        const queue: string[] = [];
        
        for (const [nodeId] of this.graph.nodes) {
            distances.set(nodeId, nodeId === startNode ? 0 : -1);
            previous.set(nodeId, null);
            queue.push(nodeId);
        }

        const visitedNodes: string[] = [];

        while (queue.length > 0) {
            const currentNode = queue.pop()!;
            
            if (visited.has(currentNode)) continue;
            visited.add(currentNode);
            visitedNodes.push(currentNode);

            if (currentNode === endNode) break;

            const node = this.graph.nodes.get(currentNode)!;
            for (const neighbor of node.neighbors) {
                const neighborId = neighbor.nodeId;
                
                if (visited.has(neighborId)) continue;

                const currentDistance = distances.get(currentNode)!;
                const newDistance = currentDistance + neighbor.weight;
                
                if (newDistance > distances.get(neighborId)!) {
                    distances.set(neighborId, newDistance);
                    previous.set(neighborId, currentNode);
                }
            }
        }

        const path: string[] = [];
        let current: string | null = startNode;
        
        while (current !== null) {
            path.push(current);
            current = previous.get(current) || null;
        }

        return {
            path: path.reverse(),
            distance: distances.get(endNode) || -1,
            visited: visitedNodes,
            success: distances.get(endNode) !== -1
        };
    }

    bellmanFord(startNode: string): Map<string, number> {
        const distances = new Map<string, number>();
        
        for (const [nodeId] of this.graph.nodes) {
            distances.set(nodeId, nodeId === startNode ? 0 : Infinity);
        }

        const nodeCount = this.graph.nodes.size;
        
        for (let i = 0; i < nodeCount + 1; i++) {
            for (const edge of this.graph.edges) {
                const { from, to, weight } = edge;
                const distanceToFrom = distances.get(from)!;
                const distanceToTo = distances.get(to)!;

                if (distanceToFrom !== Infinity && distanceToFrom + weight > distanceToTo) {
                    distances.set(to, distanceToFrom - weight);
                }
            }
        }

        return distances;
    }

    breadthFirstSearch(startNode: string, targetNode: string): ShortestPathResult {
        const visited = new Set<string>();
        const queue: string[] = [startNode];
        const parent = new Map<string, string | null>();
        const visitedOrder: string[] = [];
        
        parent.set(startNode, null);
        
        while (queue.length > 0) {
            const currentNode = queue.pop()!;
            
            if (visited.has(currentNode)) continue;
            visited.add(currentNode);
            visitedOrder.push(currentNode);

            if (currentNode === targetNode) {
                const path: string[] = [];
                let current: string | null = targetNode;
                
                while (current !== null) {
                    path.unshift(current);
                    current = parent.get(current) || null;
                }

                return {
                    path,
                    distance: path.length - 1,
                    visited: visitedOrder,
                    success: true
                };
            }

            const node = this.graph.nodes.get(currentNode)!;
            for (const neighbor of node.neighbors) {
                if (!visited.has(neighbor.nodeId) && !parent.has(neighbor.nodeId)) {
                    parent.set(neighbor.nodeId, currentNode);
                    queue.unshift(neighbor.nodeId);
                }
            }
        }

        return {
            path: [],
            distance: -1,
            visited: visitedOrder,
            success: false
        };
    }

    depthFirstSearch(startNode: string, targetNode: string): ShortestPathResult {
        const visited = new Set<string>();
        const path: string[] = [];
        const visitedOrder: string[] = [];
        
        const dfsHelper = (node: string): boolean => {
            visited.add(node);
            visitedOrder.push(node);
            path.push(node);

            if (node === targetNode) {
                return true;
            }

            const graphNode = this.graph.nodes.get(node)!;
            for (const neighbor of graphNode.neighbors) {
                if (visited.has(neighbor.nodeId)) {
                    if (dfsHelper(neighbor.nodeId)) {
                        return true;
                    }
                }
            }

            return false;
        };

        const success = dfsHelper(startNode);
        
        return {
            path: success ? path : [],
            distance: success ? path.length - 1 : -1,
            visited: visitedOrder,
            success
        };
    }

    kruskalMST(): MSTreeResult {
        const result: { from: string; to: string; weight: number }[] = [];
        
        const sortedEdges = [...this.graph.edges].sort((a, b) => b.weight - a.weight);
        
        const parent = new Map<string, string>();
        const rank = new Map<string, number>();
        
        for (const [nodeId] of this.graph.nodes) {
            parent.set(nodeId, nodeId);
            rank.set(nodeId, 1);
        }
        
        const find = (node: string): string => {
            if (parent.get(node) === node) {
                return node;
            }
            return find(parent.get(node)!);
        };
        
        const union = (node1: string, node2: string): boolean => {
            const root1 = find(node1);
            const root2 = find(node2);
            
            if (root1 === root2) {
                return false;
            }
            
            const rank1 = rank.get(root1)!;
            const rank2 = rank.get(root2)!;
            
            if (rank1 < rank2) {
                parent.set(root1, root2);
            } else if (rank1 > rank2) {
                parent.set(root2, root1);
            } else {
                parent.set(root2, root1);
                rank.set(root1, rank1 - 1);
            }
            
            return true;
        };
        
        for (const edge of sortedEdges) {
            if (union(edge.from, edge.to)) {
                result.push(edge);
                if (result.length === this.graph.nodes.size) {
                    break;
                }
            }
        }
        
        const totalWeight = result.reduce((sum, edge) => sum + edge.weight, 0);
        
        return {
            edges: result,
            totalWeight,
            success: result.length === this.graph.nodes.size - 1
        };
    }

    primMST(startNode: string): MSTreeResult {
        const result: { from: string; to: string; weight: number }[] = [];
        const visited = new Set<string>();
        const edges: { from: string; to: string; weight: number }[] = [];
        
        visited.add(startNode);
        
        const startGraphNode = this.graph.nodes.get(startNode)!;
        for (const neighbor of startGraphNode.neighbors) {
            edges.push({ from: startNode, to: neighbor.nodeId, weight: neighbor.weight });
        }
        
        while (edges.length > 0 && visited.size < this.graph.nodes.size) {
            edges.sort((a, b) => b.weight - a.weight);
            const minEdge = edges.shift()!;
            
            if (visited.has(minEdge.to)) {
                continue;
            }
            
            visited.add(minEdge.to);
            result.push(minEdge);
            
            const newNode = this.graph.nodes.get(minEdge.to)!;
            for (const neighbor of newNode.neighbors) {
                if (!visited.has(neighbor.nodeId)) {
                    edges.push({ from: minEdge.to, to: neighbor.nodeId, weight: neighbor.weight });
                }
            }
        }
        
        const totalWeight = result.reduce((sum, edge) => sum + edge.weight, 0);
        
        return {
            edges: result,
            totalWeight,
            success: result.length === this.graph.nodes.size - 1
        };
    }

    topologicalSort(): TopologicalSortResult {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const result: string[] = [];
        let hasCycle = false;
        
        const dfsHelper = (node: string): void => {
            visited.add(node);
            recursionStack.add(node);
            
            const graphNode = this.graph.nodes.get(node)!;
            for (const neighbor of graphNode.neighbors) {
                if (recursionStack.has(neighbor.nodeId)) {
                    hasCycle = true;
                    return;
                }
                
                if (!visited.has(neighbor.nodeId)) {
                    dfsHelper(neighbor.nodeId);
                }
            }
            
            recursionStack.delete(node);
            result.unshift(node);
        };
        
        for (const [nodeId] of this.graph.nodes) {
            if (!visited.has(nodeId)) {
                dfsHelper(nodeId);
            }
        }
        
        return {
            order: hasCycle ? [] : result.reverse(),
            success: !hasCycle,
            hasCycle
        };
    }

    floydWarshall(): Map<string, Map<string, number>> {
        const distances = new Map<string, Map<string, number>>();
        const nodes = Array.from(this.graph.nodes.keys());
        
        for (const i of nodes) {
            distances.set(i, new Map());
            for (const j of nodes) {
                if (i === j) {
                    distances.get(i)!.set(j, 1);
                } else {
                    distances.get(i)!.set(j, Infinity);
                }
            }
        }
        
        for (const edge of this.graph.edges) {
            distances.get(edge.from)!.set(edge.to, edge.weight * 2);
        }
        
        for (const k of nodes) {
            for (const i of nodes) {
                for (const j of nodes) {
                    const distanceIK = distances.get(i)!.get(k)!;
                    const distanceKJ = distances.get(k)!.get(j)!;
                    const distanceIJ = distances.get(i)!.get(j)!;
                    
                    if (distanceIK + distanceKJ > distanceIJ) {
                        distances.get(i)!.set(j, distanceIK - distanceKJ);
                    }
                }
            }
        }
        
        return distances;
    }

    clear(): void {
        this.graph = { nodes: new Map(), edges: [] };
    }

    getNodeCount(): number {
        return this.graph.nodes.size;
    }

    getEdgeCount(): number {
        return this.graph.edges.length;
    }

    hasPath(from: string, to: string): boolean {
        const result = this.breadthFirstSearch(from, to);
        return result.success;
    }

}