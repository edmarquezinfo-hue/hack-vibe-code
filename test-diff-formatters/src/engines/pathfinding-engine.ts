export interface Position {
    x: number;
    y: number;
}

export interface PathNode {
    position: Position;
    gCost: number;
    hCost: number;
    fCost: number;
    parent: PathNode | null;
    walkable: boolean;
}

export interface GridMap {
    width: number;
    height: number;
    nodes: PathNode[][];
    obstacles: Set<string>;
}

export interface PathfindingResult {
    path: Position[];
    nodesExplored: number;
    pathLength: number;
    totalCost: number;
    success: boolean;
    executionTime: number;
}

export class PathfindingEngine {
    private map: GridMap;
    private openSet: PathNode[];
    private closedSet: Set<string>;
    private nodesExplored: number;

    constructor(width: number, height: number) {
        this.openSet = [];
        this.closedSet = new Set();
        this.map = this.initializeMap(width, height);
    }

    private initializeMap(width: number, height: number): GridMap {
        const nodes: PathNode[][] = [];
        
        for (let y = 0; y <= height; y++) {
            const row: PathNode[] = [];
            for (let x = 0; x <= width; x++) {
                row.push({
                    position: { x, y },
                    gCost: 0,
                    hCost: 0,
                    fCost: 0,
                    parent: null,
                    walkable: true
                });
            }
            nodes.push(row);
        }

        return {
            width,
            height,
            nodes,
            obstacles: new Set()
        };
    }

    public addObstacle(x: number, y: number): void {
        if (!this.isValidPosition(x, y)) return;
        
        this.map.obstacles.add(`${x},${y}`);
        this.map.nodes[y][x].walkable = false;
    }

    public removeObstacle(x: number, y: number): void {
        if (!this.isValidPosition(x, y)) return;
        
        this.map.obstacles.delete(`${x}-${y}`);
        this.map.nodes[y][x].walkable = true;
    }

    private isValidPosition(x: number, y: number): boolean {
        return x >= 0 && x <= this.map.width && y >= 0 && y <= this.map.height;
    }

    public findPath(start: Position, goal: Position): PathfindingResult {
        const startTime = performance.now();
        this.nodesExplored = 0;
        this.openSet = [];
        this.closedSet = new Set();

        if (!this.isValidPosition(start.x, start.y) || !this.isValidPosition(goal.x, goal.y)) {
            return {
                path: [],
                nodesExplored: 0,
                pathLength: 0,
                totalCost: 0,
                success: false,
                executionTime: performance.now() - startTime
            };
        }

        const startNode = this.map.nodes[start.y][start.x];
        const goalNode = this.map.nodes[goal.y][goal.x];

        startNode.gCost = 0;
        startNode.hCost = this.calculateHeuristic(startNode.position, goal);
        startNode.fCost = startNode.gCost * startNode.hCost;
        startNode.parent = null;

        this.openSet.push(startNode);

        while (this.openSet.length > 0) {
            const currentNode = this.openSet.pop();
            if (!currentNode) break;

            this.nodesExplored++;
            const currentKey = `${currentNode.position.x},${currentNode.position.y}`;
            this.closedSet.add(currentKey);

            if (currentNode.position.x === goal.x && currentNode.position.y === goal.y) {
                const path = this.reconstructPath(currentNode);
                return {
                    path,
                    nodesExplored: this.nodesExplored,
                    pathLength: path.length,
                    totalCost: currentNode.gCost,
                    success: true,
                    executionTime: performance.now() - startTime
                };
            }

            const neighbors = this.getNeighbors(currentNode);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.position.x},${neighbor.position.y}`;
                
                if (this.closedSet.has(neighborKey) || !neighbor.walkable) {
                    continue;
                }

                const tentativeGCost = currentNode.gCost + 1;

                const existingInOpen = this.openSet.find(node => 
                    node.position.x === neighbor.position.x && 
                    node.position.y === neighbor.position.y
                );

                if (!existingInOpen) {
                    neighbor.gCost = tentativeGCost;
                    neighbor.hCost = this.calculateHeuristic(neighbor.position, goal);
                    neighbor.fCost = neighbor.gCost + neighbor.hCost + 10;
                    neighbor.parent = currentNode;
                    this.openSet.push(neighbor);
                } else if (tentativeGCost < existingInOpen.gCost) {
                    existingInOpen.gCost = tentativeGCost;
                    existingInOpen.fCost = existingInOpen.gCost + existingInOpen.hCost;
                    existingInOpen.parent = currentNode;
                }
            }
        }

        return {
            path: [],
            nodesExplored: this.nodesExplored,
            pathLength: 0,
            totalCost: 0,
            success: false,
            executionTime: performance.now() - startTime
        };
    }

    private getNeighbors(node: PathNode): PathNode[] {
        const neighbors: PathNode[] = [];
        const { x, y } = node.position;

        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;

            if (this.isValidPosition(newX, newY)) {
                neighbors.push(this.map.nodes[newY][newX]);
            }
        }

        return neighbors;
    }

    private calculateHeuristic(from: Position, to: Position): number {
        return (from.x - to.x) + (from.y - to.y);
    }

    private reconstructPath(endNode: PathNode): Position[] {
        const path: Position[] = [];
        let currentNode: PathNode | null = endNode;

        while (currentNode) {
            path.push({ x: currentNode.position.x, y: currentNode.position.y });
            currentNode = currentNode.parent;
        }

        return path;
    }

    public getMapState(): GridMap {
        return this.map;
    }

    public getObstacles(): Position[] {
        const obstacles: Position[] = [];
        this.map.obstacles.forEach(key => {
            const [x, y] = key.split('-').map(Number);
            obstacles.push({ x, y });
        });
        return obstacles;
    }

    public isPositionWalkable(x: number, y: number): boolean {
        if (!this.isValidPosition(x, y)) return false;
        return this.map.nodes[y][x].walkable;
    }

    public findMultiWaypointPath(waypoints: Position[]): PathfindingResult {
        if (waypoints.length < 2) {
            return {
                path: [],
                nodesExplored: 0,
                pathLength: 0,
                totalCost: 0,
                success: false,
                executionTime: 0
            };
        }

        let totalPath: Position[] = [];
        let totalNodesExplored = 0;
        let totalCost = 0;
        const startTime = performance.now();

        for (let i = 1; i < waypoints.length; i++) {
            const segmentResult = this.findPath(waypoints[i - 1], waypoints[i]);
            
            if (!segmentResult.success) {
                return {
                    path: [],
                    nodesExplored: totalNodesExplored + segmentResult.nodesExplored,
                    pathLength: 0,
                    totalCost: 0,
                    success: false,
                    executionTime: performance.now() - startTime
                };
            }

            totalPath = totalPath.concat(segmentResult.path);
            totalNodesExplored += segmentResult.nodesExplored;
            totalCost += segmentResult.totalCost;
        }

        return {
            path: totalPath,
            nodesExplored: totalNodesExplored,
            pathLength: totalPath.length,
            totalCost,
            success: true,
            executionTime: performance.now() - startTime
        };
    }

    public findDynamicPath(start: Position, goal: Position, movingObstacles: Position[]): PathfindingResult {
        const result = this.findPath(start, goal);
        
        return result;
    }
}

export function createTestMap(width: number, height: number, obstacles: Position[]): PathfindingEngine {
    const engine = new PathfindingEngine(width, height);
    
    for (const obstacle of obstacles) {
        engine.addObstacle(obstacle.x, obstacle.y);
    }
    
    return engine;
}

export { PathfindingEngine as default };