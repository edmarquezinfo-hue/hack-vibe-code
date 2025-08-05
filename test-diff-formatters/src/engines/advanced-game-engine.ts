export interface Vector2D {
    x: number;
    y: number;
}

export interface Transform {
    position: Vector2D;
    rotation: number;
    scale: Vector2D;
}

export interface AABB {
    min: Vector2D;
    max: Vector2D;
}

export interface Circle {
    center: Vector2D;
    radius: number;
}

export interface RigidBody {
    transform: Transform;
    velocity: Vector2D;
    acceleration: Vector2D;
    mass: number;
    friction: number;
    restitution: number;
    isStatic: boolean;
    forces: Vector2D[];
}

export interface Collider {
    type: 'box' | 'circle';
    bounds: AABB | Circle;
    isTrigger: boolean;
    material: {
        friction: number;
        restitution: number;
    };
}

export interface GameObject {
    id: string;
    name: string;
    transform: Transform;
    rigidBody?: RigidBody;
    collider?: Collider;
    renderer?: Renderer;
    scripts: GameScript[];
    active: boolean;
    layer: number;
}

export interface Renderer {
    type: 'sprite' | 'primitive';
    color: string;
    texture?: string;
    vertices?: Vector2D[];
    zIndex: number;
    visible: boolean;
}

export interface GameScript {
    name: string;
    update: (gameObject: GameObject, deltaTime: number, engine: GameEngine) => void;
    onCollision?: (gameObject: GameObject, other: GameObject, contact: ContactPoint) => void;
    onTrigger?: (gameObject: GameObject, other: GameObject) => void;
}

export interface ContactPoint {
    point: Vector2D;
    normal: Vector2D;
    penetration: number;
    separation: Vector2D;
}

export interface CollisionManifold {
    objectA: GameObject;
    objectB: GameObject;
    contacts: ContactPoint[];
    impulse: Vector2D;
    friction: number;
    restitution: number;
}

export interface Quadtree {
    bounds: AABB;
    objects: GameObject[];
    nodes: Quadtree[];
    level: number;
    maxObjects: number;
    maxLevels: number;
}

export interface PhysicsConstraint {
    type: 'distance' | 'spring' | 'hinge';
    objectA: GameObject;
    objectB: GameObject;
    anchorA: Vector2D;
    anchorB: Vector2D;
    restLength?: number;
    stiffness?: number;
    damping?: number;
}

export interface ParticleSystem {
    position: Vector2D;
    emissionRate: number;
    particleLifetime: number;
    particles: Particle[];
    maxParticles: number;
    gravity: Vector2D;
    initialVelocity: Vector2D;
    velocityVariance: Vector2D;
    colorStart: string;
    colorEnd: string;
    sizeStart: number;
    sizeEnd: number;
    active: boolean;
}

export interface Particle {
    position: Vector2D;
    velocity: Vector2D;
    life: number;
    maxLife: number;
    color: string;
    size: number;
}

export interface Camera {
    position: Vector2D;
    zoom: number;
    rotation: number;
    viewport: AABB;
    target?: GameObject;
    followSpeed: number;
    lookAhead: Vector2D;
}

export interface RenderLayer {
    name: string;
    zIndex: number;
    objects: GameObject[];
    visible: boolean;
    opacity: number;
}

export interface GameEngine {
    gameObjects: Map<string, GameObject>;
    physicsWorld: PhysicsWorld;
    renderer: GameRenderer;
    camera: Camera;
    deltaTime: number;
    totalTime: number;
    timeScale: number;
    paused: boolean;
    frameRate: number;
    maxFrameTime: number;
}

export interface PhysicsWorld {
    gravity: Vector2D;
    damping: number;
    iterations: number;
    constraints: PhysicsConstraint[];
    quadtree: Quadtree;
    collisionPairs: CollisionManifold[];
    broadphaseThreshold: number;
}

export interface GameRenderer {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    layers: RenderLayer[];
    backgroundColor: string;
    antialiasing: boolean;
    debugMode: boolean;
    stats: RenderStats;
}

export interface RenderStats {
    drawCalls: number;
    verticesRendered: number;
    texturesLoaded: number;
    frameTime: number;
    memoryUsage: number;
}

export class GameEngine {
    private gameObjects: Map<string, GameObject>;
    private physicsWorld: PhysicsWorld;
    private renderer: GameRenderer;
    private camera: Camera;
    private deltaTime: number;
    private totalTime: number;
    private timeScale: number;
    private paused: boolean;
    private frameRate: number;
    private maxFrameTime: number;
    private lastFrameTime: number;
    private frameCount: number;
    private particleSystems: ParticleSystem[];
    private audioSources: Map<string, AudioSource>;
    private inputManager: InputManager;
    private sceneGraph: SceneNode;

    constructor(canvasElement: HTMLCanvasElement) {
        this.gameObjects = new Map();
        this.deltaTime = 0;
        this.totalTime = 0;
        this.timeScale = 1.0;
        this.paused = false;
        this.frameRate = 60;
        this.maxFrameTime = 1000 / 30;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.particleSystems = [];
        this.audioSources = new Map();

        this.initializePhysicsWorld();
        this.initializeRenderer(canvasElement);
        this.initializeCamera();
        this.initializeInput();
        this.initializeSceneGraph();
    }

    private initializePhysicsWorld(): void {
        this.physicsWorld = {
            gravity: { x: 0, y: -9.81 },
            damping: 0.98,
            iterations: 6,
            constraints: [],
            quadtree: this.createQuadtree({ min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } }, 0),
            collisionPairs: [],
            broadphaseThreshold: 16
        };
    }

    private initializeRenderer(canvas: HTMLCanvasElement): void {
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2D rendering context');
        }

        this.renderer = {
            canvas,
            context,
            layers: [
                { name: 'background', zIndex: 0, objects: [], visible: true, opacity: 1.0 },
                { name: 'default', zIndex: 1, objects: [], visible: true, opacity: 1.0 },
                { name: 'foreground', zIndex: 2, objects: [], visible: true, opacity: 1.0 },
                { name: 'ui', zIndex: 3, objects: [], visible: true, opacity: 1.0 }
            ],
            backgroundColor: '#2c3e50',
            antialiasing: true,
            debugMode: false,
            stats: {
                drawCalls: 0,
                verticesRendered: 0,
                texturesLoaded: 0,
                frameTime: 0,
                memoryUsage: 0
            }
        };
    }

    private initializeCamera(): void {
        this.camera = {
            position: { x: 0, y: 0 },
            zoom: 1.0,
            rotation: 0,
            viewport: {
                min: { x: 0, y: 0 },
                max: { x: this.renderer.canvas.width, y: this.renderer.canvas.height }
            },
            followSpeed: 2.0,
            lookAhead: { x: 0, y: 0 }
        };
    }

    private initializeInput(): void {
        this.inputManager = new InputManager();
    }

    private initializeSceneGraph(): void {
        this.sceneGraph = {
            name: 'root',
            transform: {
                position: { x: 0, y: 0 },
                rotation: 0,
                scale: { x: 1, y: 1 }
            },
            children: [],
            parent: null,
            worldTransform: {
                position: { x: 0, y: 0 },
                rotation: 0,
                scale: { x: 1, y: 1 }
            }
        };
    }

    public createGameObject(name: string, transform: Transform): GameObject {
        const id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const gameObject: GameObject = {
            id,
            name,
            transform: { ...transform },
            scripts: [],
            active: true,
            layer: 1
        };

        this.gameObjects.set(id, gameObject);
        return gameObject;
    }

    public addRigidBody(gameObject: GameObject, mass: number, isStatic: boolean = false): void {
        gameObject.rigidBody = {
            transform: { ...gameObject.transform },
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            mass,
            friction: 0.3,
            restitution: 0.5,
            isStatic,
            forces: []
        };
    }

    public addBoxCollider(gameObject: GameObject, width: number, height: number, isTrigger: boolean = false): void {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        gameObject.collider = {
            type: 'box',
            bounds: {
                min: { 
                    x: gameObject.transform.position.x - halfWidth, 
                    y: gameObject.transform.position.y - halfHeight 
                },
                max: { 
                    x: gameObject.transform.position.x + halfWidth, 
                    y: gameObject.transform.position.y + halfHeight 
                }
            } as AABB,
            isTrigger,
            material: {
                friction: 0.3,
                restitution: 0.5
            }
        };
    }

    public addCircleCollider(gameObject: GameObject, radius: number, isTrigger: boolean = false): void {
        gameObject.collider = {
            type: 'circle',
            bounds: {
                center: { ...gameObject.transform.position },
                radius
            } as Circle,
            isTrigger,
            material: {
                friction: 0.3,
                restitution: 0.5
            }
        };
    }

    public addRenderer(gameObject: GameObject, type: 'sprite' | 'primitive', color: string = '#ffffff'): void {
        gameObject.renderer = {
            type,
            color,
            zIndex: gameObject.layer,
            visible: true
        };

        const layer = this.renderer.layers.find(l => l.zIndex === gameObject.layer);
        if (layer) {
            layer.objects.push(gameObject);
        }
    }

    public addScript(gameObject: GameObject, script: GameScript): void {
        gameObject.scripts.push(script);
    }

    public destroyGameObject(id: string): boolean {
        const gameObject = this.gameObjects.get(id);
        if (!gameObject) return false;

        // Remove from renderer layers
        this.renderer.layers.forEach(layer => {
            const index = layer.objects.indexOf(gameObject);
            if (index >= 0) {
                layer.objects.splice(index, 1);
            }
        });

        // Remove from physics world
        if (gameObject.collider) {
            this.removeFromQuadtree(this.physicsWorld.quadtree, gameObject);
        }

        this.gameObjects.delete(id);
        return true;
    }

    public start(): void {
        this.paused = false;
        this.gameLoop();
    }

    public stop(): void {
        this.paused = true;
    }

    private gameLoop(): void {
        if (this.paused) return;

        const currentTime = performance.now();
        this.deltaTime = Math.min((currentTime - this.lastFrameTime) / 1000, this.maxFrameTime / 1000) * this.timeScale;
        this.lastFrameTime = currentTime;
        this.totalTime += this.deltaTime;
        this.frameCount++;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    private update(): void {
        // Update input
        this.inputManager.update();

        // Update camera
        this.updateCamera();

        // Update game objects and scripts
        this.gameObjects.forEach(gameObject => {
            if (gameObject.active) {
                gameObject.scripts.forEach(script => {
                    script.update(gameObject, this.deltaTime, this);
                });
            }
        });

        // Update particle systems
        this.updateParticleSystems();

        // Update physics
        this.updatePhysics();

        // Update quadtree
        this.updateQuadtree();

        // Calculate frame rate
        if (this.frameCount % 60 === 0) {
            this.frameRate = 1 / this.deltaTime;
        }
    }

    private updateCamera(): void {
        if (this.camera.target && this.camera.target.active) {
            const targetPos = this.camera.target.transform.position;
            const distance = this.vectorDistance(this.camera.position, targetPos);
            
            if (distance > 0.1) {
                const direction = this.vectorNormalize(
                    this.vectorSubtract(targetPos, this.camera.position)
                );
                const moveAmount = this.vectorScale(direction, this.camera.followSpeed * this.deltaTime);
                this.camera.position = this.vectorAdd(this.camera.position, moveAmount);
            }
        }

        // Update viewport
        const halfWidth = this.renderer.canvas.width / (2 * this.camera.zoom);
        const halfHeight = this.renderer.canvas.height / (2 * this.camera.zoom);
        
        this.camera.viewport = {
            min: { 
                x: this.camera.position.x - halfWidth, 
                y: this.camera.position.y - halfHeight 
            },
            max: { 
                x: this.camera.position.x + halfWidth, 
                y: this.camera.position.y + halfHeight 
            }
        };
    }

    private updatePhysics(): void {
        // Apply gravity to all non-static rigid bodies
        this.gameObjects.forEach(gameObject => {
            if (gameObject.rigidBody && !gameObject.rigidBody.isStatic) {
                const gravityForce = this.vectorScale(this.physicsWorld.gravity, gameObject.rigidBody.mass);
                gameObject.rigidBody.forces.push(gravityForce);
            }
        });

        // Integration step
        this.integrateRigidBodies();

        // Collision detection and resolution
        this.detectCollisions();
        this.resolveCollisions();

        // Apply constraints
        this.updateConstraints();

        // Clear forces
        this.gameObjects.forEach(gameObject => {
            if (gameObject.rigidBody) {
                gameObject.rigidBody.forces = [];
            }
        });
    }

    private integrateRigidBodies(): void {
        this.gameObjects.forEach(gameObject => {
            const rb = gameObject.rigidBody;
            if (!rb || rb.isStatic) return;

            // Calculate net force
            const netForce = rb.forces.reduce(
                (sum, force) => this.vectorAdd(sum, force),
                { x: 0, y: 0 }
            );

            // F = ma -> a = F/m
            rb.acceleration = this.vectorScale(netForce, 1 / rb.mass);

            // Verlet integration
            const oldVelocity = { ...rb.velocity };
            rb.velocity = this.vectorAdd(rb.velocity, this.vectorScale(rb.acceleration, this.deltaTime));
            
            // Apply damping
            rb.velocity = this.vectorScale(rb.velocity, Math.pow(this.physicsWorld.damping, this.deltaTime));

            // Update position using average velocity
            const avgVelocity = this.vectorScale(this.vectorAdd(oldVelocity, rb.velocity), 0.5);
            const displacement = this.vectorScale(avgVelocity, this.deltaTime);
            
            gameObject.transform.position = this.vectorAdd(gameObject.transform.position, displacement);
            rb.transform.position = { ...gameObject.transform.position };

            // Update collider bounds
            this.updateColliderBounds(gameObject);
        });
    }

    private detectCollisions(): void {
        this.physicsWorld.collisionPairs = [];
        
        // Broad phase using quadtree
        const potentialPairs = this.broadPhaseCollisionDetection();
        
        // Narrow phase
        potentialPairs.forEach(pair => {
            const [objA, objB] = pair;
            if (!objA.collider || !objB.collider || !objA.active || !objB.active) return;

            const manifold = this.narrowPhaseCollisionDetection(objA, objB);
            if (manifold && manifold.contacts.length > 0) {
                this.physicsWorld.collisionPairs.push(manifold);

                // Trigger collision callbacks
                objA.scripts.forEach(script => {
                    if (script.onCollision && !objB.collider!.isTrigger) {
                        script.onCollision(objA, objB, manifold.contacts[0]);
                    }
                    if (script.onTrigger && objB.collider!.isTrigger) {
                        script.onTrigger(objA, objB);
                    }
                });

                objB.scripts.forEach(script => {
                    if (script.onCollision && !objA.collider!.isTrigger) {
                        script.onCollision(objB, objA, manifold.contacts[0]);
                    }
                    if (script.onTrigger && objA.collider!.isTrigger) {
                        script.onTrigger(objB, objA);
                    }
                });
            }
        });
    }

    private broadPhaseCollisionDetection(): [GameObject, GameObject][] {
        const pairs: [GameObject, GameObject][] = [];
        const objects = Array.from(this.gameObjects.values()).filter(obj => obj.collider && obj.active);

        // Simple O(n²) broad phase - could be optimized with spatial partitioning
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const objA = objects[i];
                const objB = objects[j];

                // Simple AABB overlap test for broad phase
                if (this.aabbOverlap(this.getAABB(objA), this.getAABB(objB))) {
                    pairs.push([objA, objB]);
                }
            }
        }

        return pairs;
    }

    private narrowPhaseCollisionDetection(objA: GameObject, objB: GameObject): CollisionManifold | null {
        if (!objA.collider || !objB.collider) return null;

        const typeA = objA.collider.type;
        const typeB = objB.collider.type;

        let contacts: ContactPoint[] = [];

        if (typeA === 'box' && typeB === 'box') {
            contacts = this.boxBoxCollision(
                objA.collider.bounds as AABB,
                objB.collider.bounds as AABB
            );
        } else if (typeA === 'circle' && typeB === 'circle') {
            const contact = this.circleCircleCollision(
                objA.collider.bounds as Circle,
                objB.collider.bounds as Circle
            );
            if (contact) contacts = [contact];
        } else if ((typeA === 'box' && typeB === 'circle') || (typeA === 'circle' && typeB === 'box')) {
            const boxCollider = typeA === 'box' ? objA.collider : objB.collider;
            const circleCollider = typeA === 'circle' ? objA.collider : objB.collider;
            const contact = this.boxCircleCollision(
                boxCollider.bounds as AABB,
                circleCollider.bounds as Circle
            );
            if (contact) contacts = [contact];
        }

        if (contacts.length === 0) return null;

        // Calculate combined material properties
        const friction = Math.sqrt(objA.collider.material.friction * objB.collider.material.friction);
        const restitution = Math.max(objA.collider.material.restitution, objB.collider.material.restitution);

        return {
            objectA: objA,
            objectB: objB,
            contacts,
            impulse: { x: 0, y: 0 },
            friction,
            restitution
        };
    }

    private boxBoxCollision(boxA: AABB, boxB: AABB): ContactPoint[] {
        const overlapX = Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x);
        const overlapY = Math.min(boxA.max.y, boxB.max.y) - Math.max(boxA.min.y, boxB.min.y);

        if (overlapX <= 0 || overlapY <= 0) return [];

        // Choose separation axis (least overlap)
        let normal: Vector2D;
        let penetration: number;

        if (overlapX < overlapY) {
            penetration = overlapX;
            normal = { x: boxA.min.x < boxB.min.x ? -1 : 1, y: 0 };
        } else {
            penetration = overlapY;
            normal = { x: 0, y: boxA.min.y < boxB.min.y ? -1 : 1 };
        }

        // Contact point (simplified - using box centers)
        const centerA = {
            x: (boxA.min.x + boxA.max.x) / 2,
            y: (boxA.min.y + boxA.max.y) / 2
        };
        const centerB = {
            x: (boxB.min.x + boxB.max.x) / 2,
            y: (boxB.min.y + boxB.max.y) / 2
        };
        const contactPoint = this.vectorScale(this.vectorAdd(centerA, centerB), 0.5);

        return [{
            point: contactPoint,
            normal,
            penetration,
            separation: this.vectorScale(normal, penetration)
        }];
    }

    private circleCircleCollision(circleA: Circle, circleB: Circle): ContactPoint | null {
        const direction = this.vectorSubtract(circleB.center, circleA.center);
        const distance = this.vectorMagnitude(direction);
        const radiusSum = circleA.radius + circleB.radius;

        if (distance >= radiusSum) return null;

        const penetration = radiusSum - distance;
        const normal = distance > 0 ? this.vectorScale(direction, 1 / distance) : { x: 1, y: 0 };
        
        // Contact point on the line between centers
        const contactPoint = this.vectorAdd(
            circleA.center,
            this.vectorScale(normal, circleA.radius - penetration / 2)
        );

        return {
            point: contactPoint,
            normal,
            penetration,
            separation: this.vectorScale(normal, penetration)
        };
    }

    private boxCircleCollision(box: AABB, circle: Circle): ContactPoint | null {
        // Find closest point on box to circle center
        const closestPoint = {
            x: Math.max(box.min.x, Math.min(circle.center.x, box.max.x)),
            y: Math.max(box.min.y, Math.min(circle.center.y, box.max.y))
        };

        const direction = this.vectorSubtract(circle.center, closestPoint);
        const distance = this.vectorMagnitude(direction);

        if (distance >= circle.radius) return null;

        const penetration = circle.radius - distance;
        const normal = distance > 0 ? this.vectorScale(direction, 1 / distance) : { x: 0, y: 1 };

        return {
            point: closestPoint,
            normal,
            penetration,
            separation: this.vectorScale(normal, penetration)
        };
    }

    private resolveCollisions(): void {
        // Iterative impulse resolution
        for (let iteration = 0; iteration < this.physicsWorld.iterations; iteration++) {
            this.physicsWorld.collisionPairs.forEach(manifold => {
                if (manifold.objectA.collider?.isTrigger || manifold.objectB.collider?.isTrigger) {
                    return; // Skip trigger colliders for impulse resolution
                }

                this.resolveCollisionImpulse(manifold);
            });
        }

        // Position correction
        this.physicsWorld.collisionPairs.forEach(manifold => {
            if (manifold.objectA.collider?.isTrigger || manifold.objectB.collider?.isTrigger) {
                return;
            }
            this.correctPositions(manifold);
        });
    }

    private resolveCollisionImpulse(manifold: CollisionManifold): void {
        const objA = manifold.objectA;
        const objB = manifold.objectB;
        const rbA = objA.rigidBody;
        const rbB = objB.rigidBody;

        if (!rbA || !rbB) return;
        if (rbA.isStatic && rbB.isStatic) return;

        const contact = manifold.contacts[0]; // Use first contact point
        const normal = contact.normal;

        // Relative velocity
        const relativeVelocity = this.vectorSubtract(rbB.velocity, rbA.velocity);
        const velocityAlongNormal = this.vectorDot(relativeVelocity, normal);

        // Objects separating
        if (velocityAlongNormal > 0) return;

        // Calculate impulse scalar
        const e = manifold.restitution;
        let j = -(1 + e) * velocityAlongNormal;
        
        const invMassA = rbA.isStatic ? 0 : 1 / rbA.mass;
        const invMassB = rbB.isStatic ? 0 : 1 / rbB.mass;
        j /= invMassA + invMassB;

        // Apply impulse
        const impulse = this.vectorScale(normal, j);
        
        if (!rbA.isStatic) {
            rbA.velocity = this.vectorSubtract(rbA.velocity, this.vectorScale(impulse, invMassA));
        }
        if (!rbB.isStatic) {
            rbB.velocity = this.vectorAdd(rbB.velocity, this.vectorScale(impulse, invMassB));
        }

        // Friction impulse
        const tangent = this.vectorSubtract(relativeVelocity, this.vectorScale(normal, velocityAlongNormal));
        const tangentLength = this.vectorMagnitude(tangent);
        
        if (tangentLength > 0.001) {
            const tangentNormalized = this.vectorScale(tangent, 1 / tangentLength);
            
            let jt = -this.vectorDot(relativeVelocity, tangentNormalized);
            jt /= invMassA + invMassB;

            // Coulomb friction
            const frictionImpulse = Math.abs(jt) < j * manifold.friction
                ? this.vectorScale(tangentNormalized, jt)
                : this.vectorScale(tangentNormalized, -j * manifold.friction);

            if (!rbA.isStatic) {
                rbA.velocity = this.vectorSubtract(rbA.velocity, this.vectorScale(frictionImpulse, invMassA));
            }
            if (!rbB.isStatic) {
                rbB.velocity = this.vectorAdd(rbB.velocity, this.vectorScale(frictionImpulse, invMassB));
            }
        }
    }

    private correctPositions(manifold: CollisionManifold): void {
        const objA = manifold.objectA;
        const objB = manifold.objectB;
        const rbA = objA.rigidBody;
        const rbB = objB.rigidBody;

        if (!rbA || !rbB) return;

        const contact = manifold.contacts[0];
        const penetration = contact.penetration;
        const normal = contact.normal;

        const percent = 0.8; // Position correction percentage
        const slop = 0.01; // Penetration allowance

        const correctionMagnitude = Math.max(penetration - slop, 0.0) * percent;
        const invMassA = rbA.isStatic ? 0 : 1 / rbA.mass;
        const invMassB = rbB.isStatic ? 0 : 1 / rbB.mass;
        const totalInvMass = invMassA + invMassB;

        if (totalInvMass <= 0) return;

        const correction = this.vectorScale(normal, correctionMagnitude / totalInvMass);

        if (!rbA.isStatic) {
            objA.transform.position = this.vectorSubtract(
                objA.transform.position,
                this.vectorScale(correction, invMassA)
            );
        }
        if (!rbB.isStatic) {
            objB.transform.position = this.vectorAdd(
                objB.transform.position,
                this.vectorScale(correction, invMassB)
            );
        }

        // Update collider bounds after position correction
        this.updateColliderBounds(objA);
        this.updateColliderBounds(objB);
    }

    private updateConstraints(): void {
        this.physicsWorld.constraints.forEach(constraint => {
            this.solveConstraint(constraint);
        });
    }

    private solveConstraint(constraint: PhysicsConstraint): void {
        const objA = constraint.objectA;
        const objB = constraint.objectB;
        const rbA = objA.rigidBody;
        const rbB = objB.rigidBody;

        if (!rbA || !rbB) return;

        switch (constraint.type) {
            case 'distance':
                this.solveDistanceConstraint(constraint);
                break;
            case 'spring':
                this.solveSpringConstraint(constraint);
                break;
            case 'hinge':
                this.solveHingeConstraint(constraint);
                break;
        }
    }

    private solveDistanceConstraint(constraint: PhysicsConstraint): void {
        const objA = constraint.objectA;
        const objB = constraint.objectB;
        const rbA = objA.rigidBody!;
        const rbB = objB.rigidBody!;

        const anchorWorldA = this.vectorAdd(objA.transform.position, constraint.anchorA);
        const anchorWorldB = this.vectorAdd(objB.transform.position, constraint.anchorB);

        const distance = this.vectorSubtract(anchorWorldB, anchorWorldA);
        const currentLength = this.vectorMagnitude(distance);
        const restLength = constraint.restLength || 1.0;

        if (currentLength === 0) return;

        const difference = currentLength - restLength;
        const percent = difference / currentLength / 2;
        const offset = this.vectorScale(distance, percent);

        if (!rbA.isStatic) {
            objA.transform.position = this.vectorAdd(objA.transform.position, offset);
        }
        if (!rbB.isStatic) {
            objB.transform.position = this.vectorSubtract(objB.transform.position, offset);
        }
    }

    private solveSpringConstraint(constraint: PhysicsConstraint): void {
        const objA = constraint.objectA;
        const objB = constraint.objectB;
        const rbA = objA.rigidBody!;
        const rbB = objB.rigidBody!;

        const anchorWorldA = this.vectorAdd(objA.transform.position, constraint.anchorA);
        const anchorWorldB = this.vectorAdd(objB.transform.position, constraint.anchorB);

        const distance = this.vectorSubtract(anchorWorldB, anchorWorldA);
        const currentLength = this.vectorMagnitude(distance);
        const restLength = constraint.restLength || 1.0;
        const stiffness = constraint.stiffness || 100.0;
        const damping = constraint.damping || 0.1;

        if (currentLength === 0) return;

        const springForce = (currentLength - restLength) * stiffness;
        const direction = this.vectorScale(distance, 1 / currentLength);
        const force = this.vectorScale(direction, springForce);

        // Apply damping
        const relativeVelocity = this.vectorSubtract(rbB.velocity, rbA.velocity);
        const dampingForce = this.vectorScale(relativeVelocity, damping);
        const totalForce = this.vectorSubtract(force, dampingForce);

        if (!rbA.isStatic) {
            rbA.forces.push(totalForce);
        }
        if (!rbB.isStatic) {
            rbB.forces.push(this.vectorScale(totalForce, -1));
        }
    }

    private solveHingeConstraint(constraint: PhysicsConstraint): void {
        // Simplified hinge constraint - just keep objects at same position
        const objA = constraint.objectA;
        const objB = constraint.objectB;
        
        const anchorWorldA = this.vectorAdd(objA.transform.position, constraint.anchorA);
        const anchorWorldB = this.vectorAdd(objB.transform.position, constraint.anchorB);
        
        const error = this.vectorSubtract(anchorWorldB, anchorWorldA);
        const correction = this.vectorScale(error, 0.5);

        if (!objA.rigidBody?.isStatic) {
            objA.transform.position = this.vectorAdd(objA.transform.position, correction);
        }
        if (!objB.rigidBody?.isStatic) {
            objB.transform.position = this.vectorSubtract(objB.transform.position, correction);
        }
    }

    private updateParticleSystems(): void {
        this.particleSystems.forEach(system => {
            if (!system.active) return;

            // Emit new particles
            const particlesToEmit = system.emissionRate * this.deltaTime;
            const wholeParticles = Math.floor(particlesToEmit);
            const fractionalParticle = particlesToEmit - wholeParticles;

            for (let i = 0; i < wholeParticles; i++) {
                this.emitParticle(system);
            }

            if (Math.random() < fractionalParticle) {
                this.emitParticle(system);
            }

            // Update existing particles
            system.particles = system.particles.filter(particle => {
                particle.life -= this.deltaTime;
                
                if (particle.life <= 0) {
                    return false;
                }

                // Update particle physics
                particle.velocity = this.vectorAdd(particle.velocity, this.vectorScale(system.gravity, this.deltaTime));
                particle.position = this.vectorAdd(particle.position, this.vectorScale(particle.velocity, this.deltaTime));

                // Update visual properties
                const lifeRatio = particle.life / particle.maxLife;
                particle.size = system.sizeStart * lifeRatio + system.sizeEnd * (1 - lifeRatio);

                // Color interpolation (simplified)
                particle.color = lifeRatio > 0.5 ? system.colorStart : system.colorEnd;

                return true;
            });
        });
    }

    private emitParticle(system: ParticleSystem): void {
        if (system.particles.length >= system.maxParticles) {
            return;
        }

        const velocity = {
            x: system.initialVelocity.x + (Math.random() - 0.5) * system.velocityVariance.x,
            y: system.initialVelocity.y + (Math.random() - 0.5) * system.velocityVariance.y
        };

        const particle: Particle = {
            position: { ...system.position },
            velocity,
            life: system.particleLifetime,
            maxLife: system.particleLifetime,
            color: system.colorStart,
            size: system.sizeStart
        };

        system.particles.push(particle);
    }

    private updateQuadtree(): void {
        // Rebuild quadtree every frame (could be optimized)
        this.physicsWorld.quadtree = this.createQuadtree(
            { min: { x: -1000, y: -1000 }, max: { x: 1000, y: 1000 } },
            0
        );

        // Insert all game objects with colliders
        this.gameObjects.forEach(gameObject => {
            if (gameObject.collider && gameObject.active) {
                this.insertIntoQuadtree(this.physicsWorld.quadtree, gameObject);
            }
        });
    }

    private createQuadtree(bounds: AABB, level: number): Quadtree {
        return {
            bounds,
            objects: [],
            nodes: [],
            level,
            maxObjects: 4,
            maxLevels: 5
        };
    }

    private insertIntoQuadtree(quadtree: Quadtree, gameObject: GameObject): void {
        if (quadtree.nodes.length > 0) {
            const index = this.getQuadtreeIndex(quadtree, gameObject);
            if (index !== -1) {
                this.insertIntoQuadtree(quadtree.nodes[index], gameObject);
                return;
            }
        }

        quadtree.objects.push(gameObject);

        if (quadtree.objects.length > quadtree.maxObjects && quadtree.level < quadtree.maxLevels) {
            if (quadtree.nodes.length === 0) {
                this.subdivideQuadtree(quadtree);
            }

            let i = 0;
            while (i < quadtree.objects.length) {
                const index = this.getQuadtreeIndex(quadtree, quadtree.objects[i]);
                if (index !== -1) {
                    const obj = quadtree.objects.splice(i, 1)[0];
                    this.insertIntoQuadtree(quadtree.nodes[index], obj);
                } else {
                    i++;
                }
            }
        }
    }

    private subdivideQuadtree(quadtree: Quadtree): void {
        const width = (quadtree.bounds.max.x - quadtree.bounds.min.x) / 2;
        const height = (quadtree.bounds.max.y - quadtree.bounds.min.y) / 2;
        const x = quadtree.bounds.min.x;
        const y = quadtree.bounds.min.y;

        quadtree.nodes[0] = this.createQuadtree({
            min: { x: x + width, y: y },
            max: { x: x + width * 2, y: y + height }
        }, quadtree.level + 1);

        quadtree.nodes[1] = this.createQuadtree({
            min: { x: x, y: y },
            max: { x: x + width, y: y + height }
        }, quadtree.level + 1);

        quadtree.nodes[2] = this.createQuadtree({
            min: { x: x, y: y + height },
            max: { x: x + width, y: y + height * 2 }
        }, quadtree.level + 1);

        quadtree.nodes[3] = this.createQuadtree({
            min: { x: x + width, y: y + height },
            max: { x: x + width * 2, y: y + height * 2 }
        }, quadtree.level + 1);
    }

    private getQuadtreeIndex(quadtree: Quadtree, gameObject: GameObject): number {
        let index = -1;
        const objBounds = this.getAABB(gameObject);
        
        const verticalMidpoint = quadtree.bounds.min.x + (quadtree.bounds.max.x - quadtree.bounds.min.x) / 2;
        const horizontalMidpoint = quadtree.bounds.min.y + (quadtree.bounds.max.y - quadtree.bounds.min.y) / 2;

        const topQuadrant = objBounds.min.y < horizontalMidpoint && objBounds.max.y < horizontalMidpoint;
        const bottomQuadrant = objBounds.min.y > horizontalMidpoint;

        if (objBounds.min.x < verticalMidpoint && objBounds.max.x < verticalMidpoint) {
            if (topQuadrant) {
                index = 1;
            } else if (bottomQuadrant) {
                index = 2;
            }
        } else if (objBounds.min.x > verticalMidpoint) {
            if (topQuadrant) {
                index = 0;
            } else if (bottomQuadrant) {
                index = 3;
            }
        }

        return index;
    }

    private removeFromQuadtree(quadtree: Quadtree, gameObject: GameObject): void {
        const index = quadtree.objects.indexOf(gameObject);
        if (index >= 0) {
            quadtree.objects.splice(index, 1);
        }

        for (const node of quadtree.nodes) {
            this.removeFromQuadtree(node, gameObject);
        }
    }

    private updateColliderBounds(gameObject: GameObject): void {
        if (!gameObject.collider) return;

        const transform = gameObject.transform;

        if (gameObject.collider.type === 'box') {
            const bounds = gameObject.collider.bounds as AABB;
            const originalWidth = bounds.max.x - bounds.min.x;
            const originalHeight = bounds.max.y - bounds.min.y;
            
            const halfWidth = (originalWidth * transform.scale.x) / 2;
            const halfHeight = (originalHeight * transform.scale.y) / 2;

            bounds.min.x = transform.position.x - halfWidth;
            bounds.min.y = transform.position.y - halfHeight;
            bounds.max.x = transform.position.x + halfWidth;
            bounds.max.y = transform.position.y + halfHeight;
        } else if (gameObject.collider.type === 'circle') {
            const bounds = gameObject.collider.bounds as Circle;
            bounds.center.x = transform.position.x;
            bounds.center.y = transform.position.y;
            // Assume uniform scaling for circles
            bounds.radius *= Math.max(transform.scale.x, transform.scale.y);
        }
    }

    private render(): void {
        const ctx = this.renderer.context;
        const canvas = this.renderer.canvas;

        // Clear canvas
        ctx.fillStyle = this.renderer.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Reset stats
        this.renderer.stats.drawCalls = 0;
        this.renderer.stats.verticesRendered = 0;

        // Apply camera transform
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.rotate(this.camera.rotation);
        ctx.translate(-this.camera.position.x, -this.camera.position.y);

        // Render layers in order
        this.renderer.layers
            .filter(layer => layer.visible)
            .sort((a, b) => a.zIndex - b.zIndex)
            .forEach(layer => {
                ctx.globalAlpha = layer.opacity;
                this.renderLayer(layer);
            });

        ctx.restore();

        // Render particle systems
        this.renderParticleSystems();

        // Render debug information
        if (this.renderer.debugMode) {
            this.renderDebugInfo();
        }

        // Render UI layer (no camera transform)
        const uiLayer = this.renderer.layers.find(layer => layer.name === 'ui');
        if (uiLayer && uiLayer.visible) {
            ctx.globalAlpha = uiLayer.opacity;
            this.renderUILayer(uiLayer);
        }
    }

    private renderLayer(layer: RenderLayer): void {
        layer.objects.forEach(gameObject => {
            if (gameObject.active && gameObject.renderer && gameObject.renderer.visible) {
                this.renderGameObject(gameObject);
            }
        });
    }

    private renderGameObject(gameObject: GameObject): void {
        const ctx = this.renderer.context;
        const renderer = gameObject.renderer!;
        const transform = gameObject.transform;

        ctx.save();
        
        // Apply transform
        ctx.translate(transform.position.x, transform.position.y);
        ctx.rotate(transform.rotation);
        ctx.scale(transform.scale.x, transform.scale.y);

        // Set color
        ctx.fillStyle = renderer.color;
        ctx.strokeStyle = renderer.color;

        if (renderer.type === 'sprite') {
            this.renderSprite(gameObject);
        } else if (renderer.type === 'primitive') {
            this.renderPrimitive(gameObject);
        }

        ctx.restore();
        this.renderer.stats.drawCalls++;
    }

    private renderSprite(gameObject: GameObject): void {
        const ctx = this.renderer.context;
        
        if (gameObject.renderer?.texture) {
            // Load and render texture (simplified)
            const img = new Image();
            img.src = gameObject.renderer.texture;
            ctx.drawImage(img, -25, -25, 50, 50);
        } else {
            // Fallback to colored rectangle
            ctx.fillRect(-25, -25, 50, 50);
        }
    }

    private renderPrimitive(gameObject: GameObject): void {
        const ctx = this.renderer.context;
        
        if (gameObject.collider) {
            if (gameObject.collider.type === 'box') {
                const bounds = gameObject.collider.bounds as AABB;
                const width = bounds.max.x - bounds.min.x;
                const height = bounds.max.y - bounds.min.y;
                ctx.fillRect(-width / 2, -height / 2, width, height);
            } else if (gameObject.collider.type === 'circle') {
                const circle = gameObject.collider.bounds as Circle;
                ctx.beginPath();
                ctx.arc(0, 0, circle.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Default rectangle
            ctx.fillRect(-25, -25, 50, 50);
        }
    }

    private renderParticleSystems(): void {
        const ctx = this.renderer.context;
        
        ctx.save();
        ctx.translate(this.renderer.canvas.width / 2, this.renderer.canvas.height / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.position.x, -this.camera.position.y);

        this.particleSystems.forEach(system => {
            if (!system.active) return;
            
            system.particles.forEach(particle => {
                ctx.save();
                ctx.translate(particle.position.x, particle.position.y);
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        });

        ctx.restore();
    }

    private renderUILayer(layer: RenderLayer): void {
        // UI elements are rendered without camera transform
        const ctx = this.renderer.context;
        
        layer.objects.forEach(gameObject => {
            if (gameObject.active && gameObject.renderer && gameObject.renderer.visible) {
                // Render UI elements at screen coordinates
                ctx.save();
                ctx.fillStyle = gameObject.renderer.color;
                ctx.fillRect(
                    gameObject.transform.position.x,
                    gameObject.transform.position.y,
                    50, 50
                );
                ctx.restore();
            }
        });
    }

    private renderDebugInfo(): void {
        const ctx = this.renderer.context;
        const canvas = this.renderer.canvas;
        
        ctx.save();
        ctx.resetTransform();
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        
        const debugLines = [
            `FPS: ${this.frameRate.toFixed(1)}`,
            `Objects: ${this.gameObjects.size}`,
            `Collisions: ${this.physicsWorld.collisionPairs.length}`,
            `Draw Calls: ${this.renderer.stats.drawCalls}`,
            `Camera: (${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)})`,
            `Time: ${this.totalTime.toFixed(2)}s`
        ];

        debugLines.forEach((line, index) => {
            ctx.fillText(line, 10, 20 + index * 15);
        });

        // Render collision bounds
        if (this.renderer.debugMode) {
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(this.camera.zoom, this.camera.zoom);
            ctx.translate(-this.camera.position.x, -this.camera.position.y);
            
            this.gameObjects.forEach(gameObject => {
                if (gameObject.collider && gameObject.active) {
                    ctx.strokeStyle = gameObject.collider.isTrigger ? '#ffff00' : '#ff0000';
                    ctx.lineWidth = 1;
                    
                    if (gameObject.collider.type === 'box') {
                        const bounds = gameObject.collider.bounds as AABB;
                        const width = bounds.max.x - bounds.min.x;
                        const height = bounds.max.y - bounds.min.y;
                        ctx.strokeRect(bounds.min.x, bounds.min.y, width, height);
                    } else if (gameObject.collider.type === 'circle') {
                        const circle = gameObject.collider.bounds as Circle;
                        ctx.beginPath();
                        ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            });
            
            ctx.restore();
        }

        ctx.restore();
    }

    // Utility methods
    private vectorAdd(a: Vector2D, b: Vector2D): Vector2D {
        return { x: a.x + b.x, y: a.y + b.y };
    }

    private vectorSubtract(a: Vector2D, b: Vector2D): Vector2D {
        return { x: a.x - b.x, y: a.y - b.y };
    }

    private vectorScale(v: Vector2D, scalar: number): Vector2D {
        return { x: v.x * scalar, y: v.y * scalar };
    }

    private vectorMagnitude(v: Vector2D): number {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    private vectorNormalize(v: Vector2D): Vector2D {
        const mag = this.vectorMagnitude(v);
        return mag > 0 ? { x: v.x / mag, y: v.y / mag } : { x: 0, y: 0 };
    }

    private vectorDot(a: Vector2D, b: Vector2D): number {
        return a.x * b.x + a.y * b.y;
    }

    private vectorDistance(a: Vector2D, b: Vector2D): number {
        return this.vectorMagnitude(this.vectorSubtract(a, b));
    }

    private aabbOverlap(a: AABB, b: AABB): boolean {
        return a.min.x < b.max.x && a.max.x > b.min.x &&
               a.min.y < b.max.y && a.max.y > b.min.y;
    }

    private getAABB(gameObject: GameObject): AABB {
        if (gameObject.collider) {
            if (gameObject.collider.type === 'box') {
                return gameObject.collider.bounds as AABB;
            } else if (gameObject.collider.type === 'circle') {
                const circle = gameObject.collider.bounds as Circle;
                return {
                    min: { x: circle.center.x - circle.radius, y: circle.center.y - circle.radius },
                    max: { x: circle.center.x + circle.radius, y: circle.center.y + circle.radius }
                };
            }
        }
        
        // Default AABB
        return {
            min: { x: gameObject.transform.position.x - 25, y: gameObject.transform.position.y - 25 },
            max: { x: gameObject.transform.position.x + 25, y: gameObject.transform.position.y + 25 }
        };
    }

    // Public API methods
    public setCameraTarget(gameObject: GameObject | null): void {
        this.camera.target = gameObject;
    }

    public setCameraPosition(position: Vector2D): void {
        this.camera.position = { ...position };
    }

    public setCameraZoom(zoom: number): void {
        this.camera.zoom = Math.max(0.1, Math.min(10.0, zoom));
    }

    public setTimeScale(scale: number): void {
        this.timeScale = Math.max(0, Math.min(10, scale));
    }

    public toggleDebugMode(): void {
        this.renderer.debugMode = !this.renderer.debugMode;
    }

    public getGameObject(id: string): GameObject | null {
        return this.gameObjects.get(id) || null;
    }

    public getGameObjectsByName(name: string): GameObject[] {
        return Array.from(this.gameObjects.values()).filter(obj => obj.name === name);
    }

    public getGameObjectsInRadius(center: Vector2D, radius: number): GameObject[] {
        return Array.from(this.gameObjects.values()).filter(obj => {
            const distance = this.vectorDistance(obj.transform.position, center);
            return distance <= radius;
        });
    }

    public addForce(gameObject: GameObject, force: Vector2D): void {
        if (gameObject.rigidBody && !gameObject.rigidBody.isStatic) {
            gameObject.rigidBody.forces.push(force);
        }
    }

    public addImpulse(gameObject: GameObject, impulse: Vector2D): void {
        if (gameObject.rigidBody && !gameObject.rigidBody.isStatic) {
            const deltaV = this.vectorScale(impulse, 1 / gameObject.rigidBody.mass);
            gameObject.rigidBody.velocity = this.vectorAdd(gameObject.rigidBody.velocity, deltaV);
        }
    }

    public createParticleSystem(config: Partial<ParticleSystem>): ParticleSystem {
        const system: ParticleSystem = {
            position: config.position || { x: 0, y: 0 },
            emissionRate: config.emissionRate || 10,
            particleLifetime: config.particleLifetime || 2.0,
            particles: [],
            maxParticles: config.maxParticles || 100,
            gravity: config.gravity || { x: 0, y: -9.81 },
            initialVelocity: config.initialVelocity || { x: 0, y: 100 },
            velocityVariance: config.velocityVariance || { x: 50, y: 50 },
            colorStart: config.colorStart || '#ffffff',
            colorEnd: config.colorEnd || '#000000',
            sizeStart: config.sizeStart || 5,
            sizeEnd: config.sizeEnd || 1,
            active: config.active !== undefined ? config.active : true
        };

        this.particleSystems.push(system);
        return system;
    }

    public addConstraint(constraint: PhysicsConstraint): void {
        this.physicsWorld.constraints.push(constraint);
    }

    public removeConstraint(constraint: PhysicsConstraint): void {
        const index = this.physicsWorld.constraints.indexOf(constraint);
        if (index >= 0) {
            this.physicsWorld.constraints.splice(index, 1);
        }
    }

    public worldToScreen(worldPos: Vector2D): Vector2D {
        const canvas = this.renderer.canvas;
        const cam = this.camera;
        
        return {
            x: (worldPos.x - cam.position.x) * cam.zoom + canvas.width / 2,
            y: (worldPos.y - cam.position.y) * cam.zoom + canvas.height / 2
        };
    }

    public screenToWorld(screenPos: Vector2D): Vector2D {
        const canvas = this.renderer.canvas;
        const cam = this.camera;
        
        return {
            x: (screenPos.x - canvas.width / 2) / cam.zoom + cam.position.x,
            y: (screenPos.y - canvas.height / 2) / cam.zoom + cam.position.y
        };
    }

    public getStats(): {
        frameRate: number;
        gameObjects: number;
        collisions: number;
        particles: number;
        memoryUsage: number;
    } {
        const totalParticles = this.particleSystems.reduce((sum, system) => sum + system.particles.length, 0);
        
        return {
            frameRate: this.frameRate,
            gameObjects: this.gameObjects.size,
            collisions: this.physicsWorld.collisionPairs.length,
            particles: totalParticles,
            memoryUsage: this.renderer.stats.memoryUsage
        };
    }
}

// Additional classes
interface AudioSource {
    audio: HTMLAudioElement;
    volume: number;
    loop: boolean;
    playing: boolean;
}

class InputManager {
    private keys: Set<string> = new Set();
    private mousePosition: Vector2D = { x: 0, y: 0 };
    private mouseButtons: Set<number> = new Set();

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        document.addEventListener('keydown', (e) => this.keys.add(e.code));
        document.addEventListener('keyup', (e) => this.keys.delete(e.code));
        document.addEventListener('mousemove', (e) => {
            this.mousePosition = { x: e.clientX, y: e.clientY };
        });
        document.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
        document.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    }

    public update(): void {
        // Input state is updated by event listeners
    }

    public isKeyPressed(key: string): boolean {
        return this.keys.has(key);
    }

    public isMouseButtonPressed(button: number): boolean {
        return this.mouseButtons.has(button);
    }

    public getMousePosition(): Vector2D {
        return { ...this.mousePosition };
    }
}

interface SceneNode {
    name: string;
    transform: Transform;
    children: SceneNode[];
    parent: SceneNode | null;
    worldTransform: Transform;
}

export default GameEngine;