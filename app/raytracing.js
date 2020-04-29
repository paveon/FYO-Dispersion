/*
 * FYO 2020 - Light dispersion project
 * Author: Ondřej Pavela (xpavel34@stud.fit.vutbr.cz)
 */

/*
 * wavelengthToColor() function was taken from
 * http://scienceprimer.com/javascript-code-convert-light-wavelength-color
 */
function wavelengthToColor(wl) {
    let rgb;
    if (wl >= 380 && wl < 440) {
        rgb = [-1 * (wl - 440) / (440 - 380), 0, 1];
    } else if (wl >= 440 && wl < 490) {
        rgb = [0, (wl - 440) / (490 - 440), 1];
    } else if (wl >= 490 && wl < 510) {
        rgb = [0, 1, -1 * (wl - 510) / (510 - 490)];
    } else if (wl >= 510 && wl < 580) {
        rgb = [(wl - 510) / (580 - 510), 1, 0];
    } else if (wl >= 580 && wl < 645) {
        rgb = [1, -1 * (wl - 645) / (645 - 580), 0];
    } else if (wl >= 645 && wl <= 780) {
        rgb = [1, 0, 0];
    } else {
        rgb = [0, 0, 0];
    }

    // intensty is lower at the edges of the visible spectrum.
    let alpha;
    if (wl > 780 || wl < 380) {
        alpha = 0;
    } else if (wl > 700) {
        alpha = (780 - wl) / (780 - 700);
    } else if (wl < 420) {
        alpha = (wl - 380) / (420 - 380);
    } else {
        alpha = 1;
    }

    return rgb;
}

function degToRad(deg) { return math.multiply(math.divide(deg, 180), Math.PI); }
function radToDeg(rad) { return math.divide(math.multiply(rad, 180), Math.PI); }

function normalize(vect) { return math.multiply(vect, (1.0 / math.norm(vect))); }
function crossProduct(point1, point2) { return point1[0] * point2[1] - point1[1] * point2[0]; }

function raySegmentIntersection(ray, start, end) {
    var s = math.subtract(end, start);

    var uNumerator = crossProduct(math.subtract(start, ray.origin), ray.dir);
    var denominator = crossProduct(ray.dir, s);

    if (uNumerator == 0 && denominator == 0) {
        // They are colinear
        // Do they touch? (Are any of the points equal?)
        return ray.origin === start || ray.origin === end;
    }

    if (denominator == 0) {
        // lines are paralell
        return undefined;
    }

    var u = uNumerator / denominator;
    var t = crossProduct(math.subtract(start, ray.origin), s) / denominator;

    if (t >= 0 && (u >= 0) && (u <= 1)) {
        return t;
    }

    return undefined;
}


/*
 * Calculate a resulting vector of refraction at surface with 'normal'
 * and refractive indices n1 and n2
 * Algorithm taken from article: 
 * https://graphics.stanford.edu/courses/cs148-10-summer/docs/2006--degreve--reflection_refraction.pdf
 */
function refractRay(ray, normal, point, material1, material2) {
    let rays = [];
    const cosI = -math.dot(normal, ray.dir);
    let reflectDir = undefined;
    if (math.abs(cosI) == 1.0) {
        // Ray is perpendicular, no refraction
        rays.push({
            ray: new LightRay(point, ray.dir, ray.waves),
            TIR: false
        });
    }
    else {
        for (const wave of ray.waves) {
            const n1 = material1.refractiveIndex(wave.lambda);
            const n2 = material2.refractiveIndex(wave.lambda);
            const mu = math.divide(n1, n2);
            const sin2Phi = math.pow(mu, 2) * (1 - math.pow(cosI, 2));
            if (sin2Phi > 1.0) {
                if (!reflectDir) reflectDir = math.add(ray.dir, math.multiply(math.multiply(2.0, cosI), normal));
                rays.push({
                    ray: new LightRay(point, reflectDir, [wave]),
                    TIR: true
                });
            }
            const refractDir = math.add(math.multiply(mu, ray.dir),
                math.multiply((math.subtract(mu * cosI, math.sqrt(1 - sin2Phi))), normal));
            rays.push({
                ray: new LightRay(point, refractDir, [wave]),
                TIR: false
            });
        }
    }

    return rays;
}


class LightRay {
    constructor(origin, dir, waves) {
        this.origin = origin;
        this.dir = dir;
        this.normal = getNormal(this.dir);
        this.waves = waves;
        this.inside = false;
        this.lastEdgeIdx = undefined;
        this.lastGeometry = undefined;

        this.hovered = false;
        this.selected = false;
        this.endPointHovered = false;

        this.arrowLenght = 50;
        this.arrowEndPoint = math.add(this.origin, math.multiply(this.dir, this.arrowLenght));
        this.arrowOffset = math.add(this.origin, math.multiply(this.dir, this.arrowLenght - 15));
    }

    getAngle() {
        let angle = math.acos(math.dot(this.dir, [1.0, 0.0]));
        if (this.dir[1] < 0) {
            angle = -angle;
        }
        return angle;
    }

    setAngle(angle) {
        this.dir = [Math.cos(angle), Math.sin(angle)];
        this.normal = getNormal(this.dir);
        this.arrowEndPoint = math.add(this.origin, math.multiply(this.dir, this.arrowLenght));
        this.arrowOffset = math.add(this.origin, math.multiply(this.dir, this.arrowLenght - 15));
    }

    setWavelength(wl) {
        this.waves = [{
            lambda: wl,
            color: PIXI.utils.rgb2hex(wavelengthToColor(wl))
        }];
    }

    setWavelengthRange(min, max, count) {
        const stepSize = (max - min) / count;
        this.waves = Array(count).fill().map(function (_, idx) {
            const wl = min + (idx * stepSize);
            return {
                lambda: wl,
                color: PIXI.utils.rgb2hex(wavelengthToColor(wl))
            };
        });
    }

    color() {
        return this.waves.length > 1 ? 0xffffff : this.waves[0].color;
    }

    translate(delta, mousePos) {
        if (this.endPointHovered) {
            this.dir = normalize(math.subtract(mousePos, this.origin));
            this.normal = getNormal(this.dir);
            this.arrowEndPoint = math.add(this.origin, math.multiply(this.dir, this.arrowLenght));
            this.arrowOffset = math.add(this.origin, math.multiply(this.dir, this.arrowLenght - 15));

            $("#ray-angle").val(-radToDeg(this.getAngle()).toFixed(2));
        }
        else {
            this.origin = math.add(this.origin, delta);
            this.arrowEndPoint = math.add(this.arrowEndPoint, delta);
            this.arrowOffset = math.add(this.arrowOffset, delta);
        }
    }


    pointCheck(point) {
        const d1 = math.distance(this.origin, point);
        const d2 = math.distance(this.arrowEndPoint, point);
        this.endPointHovered = d2 < 25;
        return d1 < 25 || this.endPointHovered;
    }


    draw(gfx) {
        drawLine(gfx, 0x00ff00, this.origin, this.arrowEndPoint);
        drawPoint(this.origin, gfx, 6, this.selected ? 0x0000ff : 0xffffff, 0xffffff);
        const arrowWingsLength = 7;
        const p1 = math.add(this.arrowOffset, math.multiply(this.normal, arrowWingsLength));
        const p2 = math.subtract(this.arrowOffset, math.multiply(this.normal, arrowWingsLength));
        drawLine(gfx, 0x00ff00, this.arrowEndPoint, p1);
        drawLine(gfx, 0x00ff00, this.arrowEndPoint, p2);
    }


    getSegment(length) {
        let endPoint = math.add(this.origin, math.multiply(this.dir, length));
        return new Line(0x91CF46, this.origin, endPoint);
    }

    tracePath(geometries) {
        const ray = this;
        let intersection = undefined;
        for (let i = 0; i < geometries.length; i++) {
            // Ignore last solved geometry
            if (ray.lastGeometry != geometries[i]) {
                const result = geometries[i].rayIntersection(ray);
                if (intersection != undefined) {
                    if (result != undefined && result.t < intersection.t) {
                        intersection = result;
                    }
                } else {
                    intersection = result;
                }
            }
        }

        if (intersection) {
            const result = intersection.geometry.solveRay(ray, intersection);
            let lineSegments = result.lineSegments;

            //Recursively trace emergent rays
            for (const emergentRay of result.emergentRays) {
                lineSegments = lineSegments.concat(emergentRay.tracePath(geometries));
            }

            return lineSegments;
        }
        else {
            // No intersection found, TODO: maybe fix this and find intersection with canvas boundaries
            const rayColor = this.waves.length > 1 ? 0xffffff : this.waves[0].color;
            const endPoint = math.add(this.origin, math.multiply(this.dir, 1000.0));
            return [new Line(rayColor, this.origin, endPoint)];
        }
    }
}


function drawPoint(point, gfx, size = 5, color = 0xe74c3c, edgeColor = 0xffff00) {
    gfx.lineStyle(2, edgeColor, 1);
    gfx.beginFill(color); // Red
    gfx.drawCircle(point[0], point[1], size);
    gfx.endFill();
}

function drawLine(gfx, color, p1, p2) {
    gfx.lineStyle(2, color, 1);
    gfx.moveTo(...p1);
    gfx.lineTo(...p2);
}

function drawPolyline(gfx, color, points) {
    gfx.lineStyle(2, color, 1);
    gfx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) {
        gfx.lineTo(...points[i]);
        gfx.moveTo(...points[i]);
    }
}

function getNormal(vec2D) {
    return normalize([-vec2D[1], vec2D[0]]);
}

function getSegmentVector(p1, p2) { return normalize(math.subtract(p2, p1)); }


class Material {
    static defaultCurvePoints = [
        [380, 1.9],
        [400, 1.7],
        [500, 1.5],
        [600, 1.45],
        [700, 1.41],
        [740, 1.39]
    ];

    constructor(curvePoints = undefined) {
        this.curvePoints = curvePoints ? new Map(curvePoints) : new Map(Material.defaultCurvePoints);
        this.modifiable = true;
    }

    refractiveIndex(wavelength) {
        // Dispersion curve is just a spline based on selected curve points

        // Find interval
        const curvePoints = this.curvePoints.entries();
        let p1 = undefined;
        for (const p2 of curvePoints) {
            if (p1 && wavelength >= p1[0] && wavelength <= p2[0]) {
                const wavelengthDelta = p2[0] - p1[0];
                const indexDelta = p2[1] - p1[1];
                let index = (indexDelta / wavelengthDelta) * (wavelength - p1[0]) + p1[1];

                if (this !== environmentMaterial) {
                    index = index * settings["multiplier"];
                }
                return index;
            }
            p1 = p2;
        }

        console.log(`Undefined refraction index for ${wavelength} nm wavelength, defaulting to 1.0`);
        return 1.0;
    }
}

// Fluorite crown FK51A optical glass material
class FK51A extends Material {
    constructor() {
        super();
        this.modifiable = false;
    }

    refractiveIndex(lambda) {
        lambda = lambda / 1000;
        const lambda2 = lambda * lambda;
        const A = (0.971247817 * lambda2) / (lambda2 - 0.00472301995);
        const B = (0.216901417 * lambda2) / (lambda2 - 0.0153575612);
        const C = (0.904651666 * lambda2) / (lambda2 - 168.68133);
        return Math.sqrt(A + B + C + 1);
    }
}

// Dense flint SF10 optical glass material
class DenseFlintSF10 extends Material {
    constructor() {
        super();
        this.modifiable = false;
    }

    refractiveIndex(lambda) {
        lambda = lambda / 1000;
        const lambda2 = lambda * lambda;
        const A = (1.62153902 * lambda2) / (lambda2 - 0.0122241457);
        const B = (0.256287842 * lambda2) / (lambda2 - 0.0595736775);
        const C = (1.64447552 * lambda2) / (lambda2 - 147.468793);
        return Math.sqrt(A + B + C + 1);
    }
}

// Borosilicate crown BK7 optical glass material
class BorosilicateBK7 extends Material {
    constructor() {
        super();
        this.modifiable = false;
    }

    refractiveIndex(lambda) {
        lambda = lambda / 1000;
        const lambda2 = lambda * lambda;
        const A = (1.03961212 * lambda2) / (lambda2 - 0.00600069867);
        const B = (0.231792344 * lambda2) / (lambda2 - 0.0200179144);
        const C = (1.01046945 * lambda2) / (lambda2 - 103.560653);
        return Math.sqrt(A + B + C + 1);
    }
}

// Lanthanum dense flint LaSF9 optical glass material
class LanthanumDenseFlintLASF9 extends Material {
    constructor() {
        super();
        this.modifiable = false;
    }

    refractiveIndex(lambda) {
        lambda = lambda / 1000;
        const lambda2 = lambda * lambda;
        const A = (2.00029547 * lambda2) / (lambda2 - 0.0121426017);
        const B = (0.298926886 * lambda2) / (lambda2 - 0.0538736236);
        const C = (1.80691843 * lambda2) / (lambda2 - 156.530829);
        return Math.sqrt(A + B + C + 1);
    }
}

class Water extends Material {
    constructor() {
        super([
            [380, 1.3406],
            [400, 1.3390],
            [500, 1.3350],
            [600, 1.3320],
            [700, 1.3310],
            [740, 1.3300]
        ]);
        this.modifiable = false;
    }
}


class Ice extends Material {
    constructor() {
        super([
            [380, 1.3215],
            [400, 1.3194],
            [500, 1.3130],
            [600, 1.3094],
            [700, 1.3069],
            [740, 1.3060]
        ]);
        this.modifiable = false;
    }
}



class Geometry {
    constructor(drawColor) {
        this.color = drawColor;
        this.hovered = false;
        this.selected = false;
        this.material = undefined;
        this.rotation = 0.0;
        this.colliding = new Set();

        this.customMaterial = new Material();
        this.material = this.customMaterial;
    }

    rayIntersection(ray, gfx) { }

    getProjectionRange(axis) {
        let min = math.dot(this.vertices[0], axis);
        let max = min;
        for (let i = 1; i < this.vertices.length; i++) {
            let dot = math.dot(this.vertices[i], axis);
            if (dot > max) {
                max = dot
            }
            else if (dot < min) {
                min = dot;
            }
        }
        return { min, max };
    }

    updateCollisions(geometries) {
        const thisGeometry = this;

        // Check for all colliding geometries
        this.colliding = new Set(geometries.filter(function (g) {
            if (thisGeometry !== g) {
                if (thisGeometry.isColliding(g)) {
                    if (!thisGeometry.colliding.has(g)) {
                        // New colliding geometry
                        g.colliding.add(thisGeometry);
                    }
                    return true;
                } else {
                    if (thisGeometry.colliding.has(g)) {
                        // Not colliding anymore
                        g.colliding.delete(thisGeometry);
                    }
                    return false;
                }
            }
        }));
    }

    // 2D SAT collision detection for convex polygons
    isColliding(geometry) {
        const axes = this.getAxes().concat(geometry.getAxes());
        for (const separatingAxis of axes) {
            // Project all vertices of both geometries to the axis
            const firstRange = this.getProjectionRange(separatingAxis);
            const secondRange = geometry.getProjectionRange(separatingAxis);

            // Check for overlay of projection ranges
            if (secondRange.min > firstRange.max || secondRange.max < firstRange.min) {
                return false;
            }
        }

        // Could not find separating axis, geometries are colliding
        return true;
    }

    translate(delta, _mousePos) {
        this.vertices = this.vertices.map(x => math.add(x, delta));
    }

    rotate(angle) {
        const angleDelta = angle - this.rotation;
        this.rotation = angle;
        let vertices = this.vertices;
        const center = this.getCenter();

        const vertexCount = this.vertices.length;
        for (let i = 0; i < vertexCount; i++) {
            // Translate to rotate around center of the triangle
            let vertex = math.subtract(vertices[i], center);
            vertex = [
                vertex[0] * Math.cos(angleDelta) - vertex[1] * Math.sin(angleDelta),
                vertex[0] * Math.sin(angleDelta) + vertex[1] * Math.cos(angleDelta)
            ]
            vertices[i] = math.add(vertex, center);
        }

        for (let i = 0; i < vertexCount; i++) {
            this.normals[i] = getNormal(math.subtract(vertices[(i + 1) % vertexCount], vertices[i]));
        }

        this.updateCollisions(tracedGeometries);
    }

    getRotation() { return this.rotation; }

    draw(gfx) {
        if (settings["debugOn"]) {
            this.debugDraw(gfx);
        }

        let color;
        let lineWidth = 2;
        if (this.colliding.size > 0) {
            color = 0xff0000;
            lineWidth = 4;
        }
        else if (this.hovered && this.selected) {
            color = 0x0f0fff;
            lineWidth = 3;
        }
        else if (this.hovered) {
            color = hoverColor;
            lineWidth = 3;
        }
        else if (this.selected) {
            color = selectColor;
        }
        else {
            color = this.color;
        }

        gfx.lineStyle(lineWidth, color, 1);
        if (this.vertices.length > 2) {
            gfx.drawPolygon(...this.vertices.flat());
        } else {
            drawLine(gfx, this.color, this.vertices[0], this.vertices[1]);
        }
    }


    debugDraw(gfx) {
        if (this.vertices.length > 2) {
            for (let i = 0; i < this.vertices.length; i++) {
                const v1 = this.vertices[i];
                const v2 = this.vertices[(i + 1) % this.vertices.length];
                const edgeCenter = math.divide(math.add(v1, v2), 2.0);
                const endPoint = math.add(edgeCenter, math.multiply(this.normals[i], 50.0));
                drawLine(gfx, 0xff00ff, edgeCenter, endPoint);
            }
        }
    }


    /* Checks if specified point is inside the geometry */
    pointCheck(point) {
        const vertexCount = this.vertices.length;
        for (let i = 0; i < vertexCount; i++) {
            const v1 = this.vertices[i];
            const v2 = this.vertices[(i + 1) % vertexCount];

            const edgeVector = math.subtract(v2, v1);
            const pointVector = math.subtract(point, v1);

            if (math.dot(edgeVector, pointVector) < 0) {
                return false;
            }
        }
        return true;
    }


    rayIntersection(ray) {
        let result = undefined;
        for (let i = 0; i < this.vertices.length; i++) {
            let p1 = this.vertices[i];
            let p2 = this.vertices[(i + 1) % this.vertices.length];
            let param = raySegmentIntersection(ray, p1, p2);
            if (param != undefined) {
                if (result != undefined) {
                    if (param < result.t) {
                        result = {
                            t: param,
                            edgeIdx: i,
                            edgeVector: getSegmentVector(p1, p2),
                            edgeNormal: this.normals[i],
                            geometry: this
                        };
                    }
                }
                else {
                    result = {
                        t: param,
                        edgeIdx: i,
                        edgeVector: getSegmentVector(p1, p2),
                        edgeNormal: this.normals[i],
                        geometry: this
                    };
                }
            }
        }

        return result;
    }


    solveRay(ray, intersection) {
        let lineSegments = [];
        let emergentRays = [];
        const vertexCount = this.vertices.length;

        if (this.pointCheck(ray.origin)) {
            //TODO
        }
        else {
            // Ray origin is outside the geometry
            const enterPoint = math.add(ray.origin, math.multiply(ray.dir, intersection.t));
            lineSegments.push(new Line(ray.color(), ray.origin, enterPoint));
            let rays = refractRay(ray, intersection.edgeNormal, enterPoint, environmentMaterial, this.material);
            rays = rays.map(function (x) {
                x.ray.lastEdgeIdx = intersection.edgeIdx;
                x.ray.inside = !x.TIR;
                return x;
            });

            while (rays.length > 0) {
                let rayData = rays.pop();
                let currentRay = rayData.ray;

                if (!currentRay.inside) {
                    currentRay.lastEdgeIdx = undefined;
                    currentRay.inside = false;
                    currentRay.lastGeometry = this;
                    emergentRays.push(currentRay);
                    continue;
                }

                // Find next incidence edge
                let nextEdgeIdx;
                let t = undefined;
                for (let i = 0; i < vertexCount; i++) {
                    if (i == currentRay.lastEdgeIdx) {
                        continue;
                    }
                    let p1 = this.vertices[i];
                    let p2 = this.vertices[(i + 1) % vertexCount];
                    t = raySegmentIntersection(currentRay, p1, p2);
                    if (t != undefined) {
                        nextEdgeIdx = i;
                        break;
                    }
                }

                // Calculate incidence point
                if (t != undefined) {
                    const nextPoint = math.add(currentRay.origin, math.multiply(currentRay.dir, t));
                    lineSegments.push(new Line(currentRay.color(), currentRay.origin, nextPoint));
                    const invertedNormal = math.multiply(-1, this.normals[nextEdgeIdx]);
                    let newRays = refractRay(currentRay, invertedNormal, nextPoint, this.material, environmentMaterial);
                    rays = rays.concat(newRays.map(x => {
                        x.ray.lastEdgeIdx = nextEdgeIdx;
                        x.ray.inside = x.TIR;
                        return x;
                    }));
                }
                else {
                    // TODO?
                }
            }
        }

        return {
            lineSegments,
            emergentRays
        };
    }
}


class Line extends Geometry {
    constructor(drawColor, v1, v2) {
        super(drawColor);
        this.vertices = [v1, v2];
    }
}

class Rectangle extends Geometry {
    static idCounter = 0;

    constructor(drawColor, v, width, height) {
        super(drawColor);
        this.id = (Rectangle.idCounter++);

        this.height = height;
        this.width = width;
        this.vertices = [
            math.add(v, [0, height]),
            math.add(v, [width, height]),
            math.add(v, [width, 0]),
            v,
        ];

        this.normals = [
            getNormal(math.subtract(this.vertices[1], this.vertices[0])),
            getNormal(math.subtract(this.vertices[2], this.vertices[1])),
            getNormal(math.subtract(this.vertices[3], this.vertices[2])),
            getNormal(math.subtract(this.vertices[0], this.vertices[3])),
        ];
    }

    getAxes() { return this.normals.slice(0, 2); }

    getCenter() { return math.divide(math.add(this.vertices[0], this.vertices[2]), 2.0); }

    getWidth() { return this.width; }
    getHeight() { return this.height; }

    setWidth(value) {
        this.width = value;
        const dir = normalize(math.subtract(this.vertices[1], this.vertices[0]));
        this.vertices[1] = math.add(this.vertices[0], math.multiply(this.width, dir));
        this.vertices[2] = math.add(this.vertices[3], math.multiply(this.width, dir));

        this.updateCollisions(tracedGeometries);
    }

    setHeight(value) {
        this.height = value;
        const dir = normalize(math.subtract(this.vertices[3], this.vertices[0]));
        this.vertices[2] = math.add(this.vertices[1], math.multiply(this.height, dir));
        this.vertices[3] = math.add(this.vertices[0], math.multiply(this.height, dir));

        this.updateCollisions(tracedGeometries);
    }
}

class Triangle extends Geometry {
    static idCounter = 0;

    constructor(drawColor, v1, v2, v3) {
        super(drawColor);
        this.id = (Triangle.idCounter++);

        this.vertices = [v1, v2, v3];
        this.normals = [
            getNormal(math.subtract(v2, v1)),
            getNormal(math.subtract(v3, v2)),
            getNormal(math.subtract(v1, v3))
        ];
        this.apexAngle = Math.PI - math.acos(math.dot(this.normals[1], this.normals[2]));
        this.height = (math.distance(v1, v2) / 2.0) / Math.tan(this.apexAngle / 2.0);
    }

    getAxes() { return this.normals; }

    getCenter() { return math.divide(math.add(math.add(this.vertices[0], this.vertices[1]), this.vertices[2]), 3.0); }

    getAngle() {
        return this.apexAngle;
    }

    getHeight() {
        return this.height;
    }

    setAngle(angle) {
        this.apexAngle = angle;
        const halfAngle = this.apexAngle / 2.0;
        let baseMidpoint = math.divide(math.add(this.vertices[0], this.vertices[1]), 2.0);
        let baseDir = normalize(math.subtract(this.vertices[1], this.vertices[0]));
        let baseHalfLength = this.height * Math.tan(halfAngle);
        this.vertices[0] = math.add(baseMidpoint, math.multiply(-baseHalfLength, baseDir));
        this.vertices[1] = math.add(baseMidpoint, math.multiply(baseHalfLength, baseDir));
        this.normals[1] = getNormal(math.subtract(this.vertices[2], this.vertices[1]));
        this.normals[2] = getNormal(math.subtract(this.vertices[0], this.vertices[2]));

        this.updateCollisions(tracedGeometries);
    }

    setHeight(height) {
        this.height = height;
        const halfAngle = this.apexAngle / 2.0;
        let hypotenuseLenght = this.height / Math.cos(halfAngle);
        let rightDir = normalize(math.subtract(this.vertices[1], this.vertices[2]));
        let leftDir = normalize(math.subtract(this.vertices[0], this.vertices[2]));
        this.vertices[0] = math.add(this.vertices[2], math.multiply(hypotenuseLenght, leftDir));
        this.vertices[1] = math.add(this.vertices[2], math.multiply(hypotenuseLenght, rightDir));

        this.updateCollisions(tracedGeometries);
    }

    pointCheck(point) {
        function sign(p1, p2, p3) {
            return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
        }

        const d1 = sign(point, this.vertices[0], this.vertices[1]);
        const d2 = sign(point, this.vertices[1], this.vertices[2]);
        const d3 = sign(point, this.vertices[2], this.vertices[0]);

        const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        return !(has_neg && has_pos);
    }
}

function selectObject(key, object) {
    if (selection[key]) {
        if (selection[key] != object) {
            selection[key].selected = false;
            selection[key] = object;
            if (object) {
                selection[key].selected = true;
            }
        }
        else {
            selection[key].selected = false;
            selection[key] = undefined;
        }
    } else {
        selection[key] = object;
        if (object) {
            selection[key].selected = true;
        }
    }
}

function selectGeometry(geometry) {
    selectObject("geometry", geometry);

    if (selection.geometry) {
        setNumberInputs(geometry.material);
        selection.material = geometry.material;
        $('#geometryType').text("Dispersion curve: " + geometry.constructor.name + "#" + geometry.id);
        // $('#unselected-div').hide();
        $('#rotate-div').show();
        $('#selected-div').show();
        $('#geometry-rotation').val(radToDeg(-geometry.getRotation()).toFixed(3));

        switch (geometry.constructor) {
            case Rectangle:
                $('#triangle-div').hide();
                $('#rectangle-div').show();
                $('#rect-width').val(geometry.getWidth().toFixed(3));
                $('#rect-height').val(geometry.getHeight().toFixed(3));
                break;

            case Triangle:
                $('#rectangle-div').hide();
                $('#triangle-div').show();
                $('#triangle-angle').val(radToDeg(geometry.getAngle()).toFixed(3));
                $('#triangle-height').val(geometry.getHeight().toFixed(3));
                break;
        }
    } else {
        setNumberInputs(environmentMaterial);
        selection.material = environmentMaterial;
        $('#geometryType').text("Dispersion curve: environment");
        $('#rectangle-div').hide();
        $('#triangle-div').hide();
        $('#rotate-div').hide();
        $('#selected-div').hide();
        // $('#unselected-div').show();
    }

    computeCurvePoints();
    renderSettings();
    renderScene();
}


function selectRay(ray) {
    selectObject("ray", ray);

    if (selection.ray) {
        $("#ray-inputs").show();
        $("#ray-angle").val(-radToDeg(ray.getAngle()).toFixed(2));
        const waves = selection.ray.waves;
        if (waves.length > 1) {
            $("#ray-count").val(waves.length);
            $("#wavelength-min").val(waves[0].lambda);
            $("#wavelength-max").val(waves[waves.length - 1].lambda);
        }
        else {
            $("#ray-wavelength").val(waves[0].lambda);
        }
    }
    else {
        $("#ray-inputs").hide();
    }

    // renderSettings();
    renderScene();
}


let settings = {
    "refraction": 1.5,
    "debugOn": true,
    "multiplier": 1.0,
    "multiplier-min": 1.0,
    "multiplier-max": 3.0,
    "wavelength-min": 380,
    "wavelength-max": 740,
    "ray-min": 2,
    "ray-max": 25,
    "ray-count": 25
}


let leftMouseDown = false;
let lastMousePos = [0, 0];

let activeRays = [];
let tracedGeometries = [];
let renderLines = [];

let rayCanvasDiv = null;
let rayCanvas = null;
let rayApp = null;
let rayGfx = new PIXI.Graphics();

let curveCanvas = null;
let curveCanvasDiv = null;
let settingsApp = null;
let settingsGfx = new PIXI.Graphics();

const basicCurvePoints = [
    [380, 1.0],
    [400, 1.0],
    [500, 1.0],
    [600, 1.0],
    [700, 1.0],
    [740, 1.0]
];

const basicMaterial = new Material(basicCurvePoints);
let environmentMaterial = basicMaterial;

const materialFK51A = new FK51A();
const materialDenseFlintSF10 = new DenseFlintSF10();
const materialBK7 = new BorosilicateBK7();
const materialLASF9 = new LanthanumDenseFlintLASF9();
const materialWater = new Water();
const materialIce = new Ice();

const hoverColor = 0xff00ff;
const selectColor = 0x00ffff;

let hoveredObject = undefined;

let selection = {
    "geometry": undefined,
    "ray": undefined,
    "material": environmentMaterial
}

//TODO: simulate more precisely, implement refractive index curves somehow
// function dispersionCurve(wavelength) {
//     return refractiveIndexBase + ((740 - wavelength) / (740 * 4));
// }


// const whitelightWavelengths = [380.0, 400.0, 500.0, 600.0, 700.0, 740.0];
const lightWaves = [380.0, 400.0, 500.0, 600.0, 700.0, 740.0].map(x => {
    return {
        lambda: x,
        color: PIXI.utils.rgb2hex(wavelengthToColor(x))
    }
});

function renderScene() {
    rayGfx.clear();

    for (const geometry of tracedGeometries) {
        geometry.draw(rayGfx);
    }

    for (const line of renderLines) {
        line.draw(rayGfx);
    }

    for (const ray of activeRays) {
        ray.draw(rayGfx);
    }

    rayApp.render();
    rayApp.stop();
}

const offsets = {
    top: 10,
    bottom: 50,
    left: 50,
    right: 30
};

const rectSize = {
    width: 10,
    height: 10
};

const spectrumWidth = 740 - 380;
const maxN = 2.5;
const minN = 1.0;
const deltaN = maxN - minN;

const axisLabelOpts = { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, align: 'center' };
const wavelengthLabelOpts = { fontFamily: 'Arial', fontSize: 11, fill: 0xffffff, align: 'center' };

let canvasData = {
    w: 0,
    h: 0,
    innerW: 0,
    innerH: 0,
    zero: undefined,
    right: undefined,
    up: undefined,
    xLabel: new PIXI.Text("wavelength (nm)", axisLabelOpts),
    yLabel: new PIXI.Text("index - n", axisLabelOpts),
    lines: new Array(lightWaves.length),
    curve: new Array(lightWaves.length),
    curveX: new Array(lightWaves.length),
    labels: lightWaves.map(x => new PIXI.Text(x.lambda.toString(), wavelengthLabelOpts))
}

function computeCurveCanvas() {
    canvasData.w = curveCanvas.width;
    canvasData.h = curveCanvas.height;
    canvasData.innerW = curveCanvas.width - offsets.left - offsets.right;
    canvasData.innerH = curveCanvas.height - offsets.top - offsets.bottom;
    canvasData.zero = [offsets.left - 20, curveCanvas.height - offsets.bottom];
    canvasData.right = [curveCanvas.width, canvasData.zero[1]];
    canvasData.up = [canvasData.zero[0], offsets.top];

    canvasData.yLabel.position.y = canvasData.zero[1] - 5;
    canvasData.xLabel.position.x = (canvasData.w / 2) - (canvasData.xLabel.width / 2);
    canvasData.xLabel.position.y = canvasData.h - canvasData.xLabel.height - 2;

    for (let i = 0; i < lightWaves.length; i++) {
        canvasData.curveX[i] = ((lightWaves[i].lambda - 380) / spectrumWidth) * canvasData.innerW + offsets.left;
        const p1 = [canvasData.curveX[i], offsets.top]
        const p2 = [canvasData.curveX[i], canvasData.h - offsets.bottom];
        canvasData.lines[i] = [p1, p2];

        canvasData.labels[i].angle = 90;
        canvasData.labels[i].position.x = p2[0] + canvasData.labels[i].height / 2;
        canvasData.labels[i].position.y = p2[1] + canvasData.labels[i].width / 2;

        const n = selection.material.curvePoints.get(lightWaves[i].lambda);
        const rectCenter = [
            canvasData.curveX[i],
            canvasData.h - offsets.bottom - ((n - minN) / deltaN) * (canvasData.innerH)
        ];

        canvasData.curve[i] = rectCenter;
    }
}

function computeCurvePoints() {
    for (let i = 0; i < lightWaves.length; i++) {
        const n = selection.material.curvePoints.get(lightWaves[i].lambda);
        canvasData.curve[i][1] = canvasData.h - offsets.bottom - ((n - minN) / deltaN) * (canvasData.innerH);
    }
}


function renderSettings() {
    settingsGfx.clear();

    if (selection.material.modifiable) {
        for (let i = 0; i < lightWaves.length; i++) {
            drawLine(settingsGfx, lightWaves[i].color, ...canvasData.lines[i]);

            if (selectedWavelength == lightWaves[i].lambda) {
                settingsGfx.lineStyle(1, 0xff0000, 1);
            } else {
                settingsGfx.lineStyle(1, 0xffffff, 0);
            }
            settingsGfx.beginFill(0xffffff);
            const rectCenter = canvasData.curve[i];
            settingsGfx.drawRect(rectCenter[0] - rectSize.width / 2, rectCenter[1] - rectSize.height / 2, rectSize.width, rectSize.height);
            settingsGfx.endFill();
        }

        drawPolyline(settingsGfx, 0xffffff, canvasData.curve);
    }
    else {
        // Non modifiable material, draw precise curve
        for (let i = 0; i < lightWaves.length; i++) {
            drawLine(settingsGfx, lightWaves[i].color, ...canvasData.lines[i]);
        }

        let points = [];
        const nMax = selection.material.refractiveIndex(380);
        let nMin = selection.material.refractiveIndex(740);
        let nDelta = (nMax - nMin);
        nMin -= (nDelta / 10.0);
        nDelta = (nMax - nMin) * 1.1;
        for (let i = 380; i <= 740; i += 10) {
            const n = selection.material.refractiveIndex(i);
            const x = ((i - 380) / spectrumWidth) * canvasData.innerW + offsets.left;
            const y = canvasData.h - offsets.bottom - ((n - nMin) / nDelta) * (canvasData.innerH);
            points.push([x, y]);
        }
        drawPolyline(settingsGfx, 0xffffff, points);
    }

    // Wavelength axis and arrow
    let wing = [canvasData.right[0] - 10, canvasData.right[1] - 5];
    drawLine(settingsGfx, 0xffffff, canvasData.zero, canvasData.right);
    drawLine(settingsGfx, 0xffffff, canvasData.right, wing);
    wing[1] += 10;
    drawLine(settingsGfx, 0xffffff, canvasData.right, wing);

    // Index axis and arrow
    wing = [canvasData.up[0] - 5, canvasData.up[1] + 10];
    drawLine(settingsGfx, 0xffffff, canvasData.zero, canvasData.up);
    drawLine(settingsGfx, 0xffffff, canvasData.up, wing);
    wing[0] += 10;
    drawLine(settingsGfx, 0xffffff, canvasData.up, wing);

    settingsApp.render();
    settingsApp.stop();
}


let lastMousePosSettings = [0, 0];
let leftMouseDownSettings = false;
let selectedWavelength = undefined;
let selectedWavelengthIdx = undefined;
let selectedWavelengthInput = undefined;


function handleMouseMoveSettings(e) {
    if (!selection.material.modifiable) {
        return;
    }

    const mousePos = [e.offsetX, e.offsetY];
    if (selectedWavelength && leftMouseDownSettings) {
        // Box drag
        let y = Math.max(0, Math.min((canvasData.h - mousePos[1] - offsets.bottom), canvasData.innerH));
        canvasData.curve[selectedWavelengthIdx][1] = canvasData.h - offsets.bottom - y;
        const newN = ((y * deltaN) / canvasData.innerH) + minN;
        selection.material.curvePoints.set(selectedWavelength, newN);
        selectedWavelengthInput.val(newN.toFixed(3));
        renderSettings();
    }
    else {

        let hoveredWavelengthIdx = undefined;
        let minDist = undefined;
        for (let i = 0; i < canvasData.curve.length; i++) {
            const d = math.distance(canvasData.curve[i], mousePos);
            if (d < 10) {
                if (hoveredWavelengthIdx != undefined) {
                    if (d < minDist) {
                        hoveredWavelengthIdx = i;
                        minDist = d;
                    }
                } else {
                    hoveredWavelengthIdx = i;
                    minDist = d;
                }
            }
        }

        if (hoveredWavelengthIdx != undefined) {
            const hoveredWavelength = lightWaves[hoveredWavelengthIdx].lambda;
            if (!selectedWavelength || selectedWavelength != hoveredWavelength) {
                // Entering box, redraw
                curveCanvas.style.cursor = "pointer";
                selectedWavelength = hoveredWavelength;
                selectedWavelengthIdx = hoveredWavelengthIdx;
                renderSettings();
            }
        }
        else {
            // No box is currently hovered
            if (selectedWavelength) {
                // Leaving box, redraw
                curveCanvas.style.cursor = "default";
                selectedWavelength = undefined;
                selectedWavelengthIdx = undefined;
                renderSettings();
            }
        }
    }

    lastMousePos = mousePos;
}


function handleMouseDownSettings(e) {
    if (selectedWavelength) {
        switch (e.which) {
            case 1:
                curveCanvas.style.cursor = "move";
                leftMouseDownSettings = true;
                selectedWavelengthInput = $('input#' + selectedWavelength.toString() + "nm");
                break; // Left
        }
    }
}

function handleMouseUpSettings(e) {
    switch (e.which) {
        case 1:
            leftMouseDownSettings = false;
            if (selectedWavelength) {
                // Geometry drag end
                renderLines = traceRays(activeRays, tracedGeometries);
                curveCanvas.style.cursor = "pointer";
                renderScene();
            }
            else {
                curveCanvas.style.cursor = "default";
            }
            break;
    }
}



function handleMouseMove(e) {
    const point = [e.offsetX, e.offsetY];
    if (hoveredObject && leftMouseDown) {
        // Dragging geometry, translate by delta
        const delta = math.subtract(point, lastMousePos);
        hoveredObject.translate(delta, point);

        if (hoveredObject instanceof Geometry) {
            hoveredObject.updateCollisions(tracedGeometries);
        }

        renderScene();
    }
    else {
        const object = tracedGeometries.concat(activeRays).find(obj => obj.pointCheck(point));
        if (object) {
            if (hoveredObject) {
                // Already hovering over an object
                if (object != hoveredObject) {
                    // Switching between hovered objects
                    hoveredObject.hovered = false;
                    hoveredObject = object;
                    hoveredObject.hovered = true;
                    renderScene();
                }
            }
            else {
                // Entering geometry, redraw
                rayCanvas.style.cursor = "pointer";
                hoveredObject = object;
                hoveredObject.hovered = true;
                renderScene();
            }
        }
        else {
            // No geometry is currently hovered
            if (hoveredObject) {
                // Leaving geometry, redraw
                rayCanvas.style.cursor = "default";
                hoveredObject.hovered = false;
                hoveredObject = undefined;
                renderScene();
            }
        }
    }

    lastMousePos = point;
}


function handleMouseDown(e) {
    if (hoveredObject) {
        switch (e.which) {
            case 1:
                rayCanvas.style.cursor = "move";
                leftMouseDown = true;
                renderLines = [];
                break;

            case 3:
                if (hoveredObject instanceof Geometry) {
                    selectGeometry(hoveredObject);
                }
                else {
                    selectRay(hoveredObject);
                }
                break;
        }
    }
    else {
        selectGeometry(undefined);
    }
}


function setNumberInputs(material) {
    for (const [wavelength, n] of material.curvePoints) {
        $('input#' + wavelength.toString() + "nm").val(n.toFixed(3));
    }
}


function handleMouseUp(e) {
    switch (e.which) {
        case 1:
            if (hoveredObject) {
                // Geometry drag end
                renderLines = traceRays(activeRays, tracedGeometries);
                rayCanvas.style.cursor = "pointer";
                renderScene();
            }
            else {
                rayCanvas.style.cursor = "default";
            }
            leftMouseDown = false;
            break;

        case 3: break;
    }
}

function processInput(e, action) {
    element = e.target;
    let value;
    if (element.getAttribute("type") == "checkbox") {
        value = element.checked;
    }
    else {
        value = parseFloat(element.value);
        value = isNaN(value) ? undefined : value;
    }

    if (value != undefined) {
        action(value);

        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
        renderSettings();
    }
}


function AddTraceGeometry(geometry) {
    tracedGeometries.push(geometry);
    geometry.updateCollisions(tracedGeometries);
}


/*
 * Registers callbacks when the page load
 */
document.addEventListener("DOMContentLoaded", function () {
    $('#create-ray').click(function (e) {
        activeRays.push(new LightRay([50, 50], [1.0, 0.0], lightWaves));
        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
    });

    $('#delete-ray').click(function (e) {
        activeRays = activeRays.filter(x => x !== selection.ray);
        delete selection.ray;
        selectRay(undefined);
        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
    });

    $('#create-div input').click(function (e) {
        const center = [
            rayApp.renderer.width / 2.0,
            rayApp.renderer.height / 2.0
        ];

        switch (e.target.id) {
            case "rectangle":
                AddTraceGeometry(new Rectangle(0xffffff, math.subtract(center, 50), 100, 100));
                break;
            case "triangle":
                AddTraceGeometry(new Triangle(0xffffff,
                    [center[0] - 50, center[1]],
                    [center[0] + 50, center[1]],
                    [center[0], center[1] - 100])
                );
                break;
            case "ray":
                activeRays.push(new LightRay([50, 50], [1.0, 0.0], lightWaves));
                break;
        }
        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
    });

    $('#delete-geometry').click(function (e) {
        tracedGeometries = tracedGeometries.filter(x => x !== selection.geometry);
        delete selection.geometry;
        selectGeometry(undefined);
        tracedGeometries.forEach(x => x.updateCollisions(tracedGeometries));
        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
    });

    $('#copy-geometry').click(function (e) {
        let geometry = Object.create(selection.geometry);
        geometry.constructor.idCounter++
        geometry.id = geometry.constructor.idCounter;
        geometry.vertices = [];
        geometry.normals = [];
        geometry.colliding = new Set();
        geometry.material = new Material(Array.from(selection.geometry.material.curvePoints));
        selection.geometry.vertices.forEach(v => geometry.vertices.push(v.slice()));
        selection.geometry.normals.forEach(n => geometry.normals.push(n.slice()));
        geometry.translate([50, 50], undefined);
        AddTraceGeometry(geometry);
        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
    });

    $("#ray-count").val(settings["ray-count"]);
    $("#wavelength-min").val(settings["wavelength-min"]);
    $("#wavelength-max").val(settings["wavelength-max"]);

    // $(".wavelength").focusout(function (e) { $(this).val(selection.material.curvePoints.get(parseInt(this.id)).toFixed(3)); });
    // $("#multiplier").focusout(function (e) { $(this).val(settings["multiplier"].toFixed(3)); });
    // $("#ray-count").focusout(function (e) { $(this).val(settings["ray-count"]); });
    // $("#ray-angle").focusout(function (e) { $(this).val(-radToDeg(selection.ray.getAngle()).toFixed(2)); });
    // $("#wavelength-min").focusout(function (e) { $(this).val(settings["wavelength-min"]); });
    // $("#wavelength-max").focusout(function (e) { $(this).val(settings["wavelength-max"]); });
    // $("#rect-width").focusout(function (e) { selection.geometry && $(this).val(selection.geometry.getWidth().toFixed(3)); });
    // $("#rect-height").focusout(function (e) { selection.geometry && $(this).val(selection.geometry.getHeight().toFixed(3)); });
    // $("#triangle-angle").focusout(function (e) { selection.geometry && $(this).val(radToDeg(selection.geometry.getAngle()).toFixed(3)); });
    // $("#triangle-height").focusout(function (e) { selection.geometry && $(this).val(selection.geometry.getHeight().toFixed(3)); });

    $("#ray-count").on('input', e => processInput(e, function (value) {
        settings["ray-count"] = Math.max(settings["ray-min"], Math.min(value, settings["ray-max"]));
        selection.ray.setWavelengthRange(settings["wavelength-min"], settings["wavelength-max"], settings["ray-count"]);
    }));

    $("#ray-angle").on('input', e => processInput(e, function (value) {
        selection.ray.setAngle(-degToRad(Math.max(-180, Math.min(value, 180))));
    }));

    $("#rect-width").on('input', e => processInput(e, function (value) {
        selection.geometry.setWidth(Math.max(50, Math.min(parseInt(value), 300)));
    }));
    $("#rect-height").on('input', e => processInput(e, function (value) {
        selection.geometry.setHeight(Math.max(50, Math.min(parseInt(value), 300)));
    }));
    $("#triangle-angle").on('input', e => processInput(e, function (value) {
        selection.geometry.setAngle(degToRad(Math.max(15, Math.min(parseInt(value), 120))));
    }));
    $("#triangle-height").on('input', e => processInput(e, function (value) {
        selection.geometry.setHeight(Math.max(50, Math.min(parseInt(value), 300)));
    }));
    $("#geometry-rotation").on('input', e => processInput(e, function (value) {
        selection.geometry.rotate(-degToRad(Math.max(-180, Math.min(value, 180))));
    }));

    $("#multiplier").on('input', e => processInput(e, function (value) {
        settings["multiplier"] = Math.max(settings["multiplier-min"], Math.min(value, settings["multiplier-max"]));
    }));

    $("#wavelength-min").on('input', e => processInput(e, function (value) {
        const maxValue = Math.min(settings["wavelength-max"] - 25, 740);
        settings["wavelength-min"] = Math.max(380, Math.min(parseInt(value), maxValue));
        selection.ray.setWavelengthRange(settings["wavelength-min"], settings["wavelength-max"], settings["ray-count"]);
    }));

    $("#wavelength-max").on('input', e => processInput(e, function (value) {
        const minValue = Math.max(settings["wavelength-min"] + 25, 380);
        settings["wavelength-max"] = Math.max(minValue, Math.min(parseInt(value), 740));
        selection.ray.setWavelengthRange(settings["wavelength-min"], settings["wavelength-max"], settings["ray-count"]);
    }));

    $('.wavelength').on('input', e => processInput(e, function (value) {
        value = Math.max(minN, Math.min(value, maxN));
        selection.material.curvePoints.set(parseInt(e.target.id), value);
        computeCurvePoints();
    }));

    $('#ray-wavelength').on('input', e => processInput(e, function (value) {
        value = Math.max(settings["wavelength-min"], Math.min(value, settings["wavelength-max"]));
        selection.ray.setWavelength(value);
    }));

    $('#rotate-div').hide();
    $('label[for=ray-wavelength], input#ray-wavelength').hide();
    $('#monochromatic').change(function () {
        const wavelengthInput = $('#ray-wavelength');
        if (this.checked) {
            selection.ray.waves = [lightWaves[0]];
            wavelengthInput.val(lightWaves[0].lambda);
            $('label[for=ray-count], input#ray-count').hide();
            $('label[for=wavelength-min], input#wavelength-min').hide();
            $('label[for=wavelength-max], input#wavelength-max').hide();
            $('label[for=ray-wavelength], input#ray-wavelength').show();
        }
        else {
            selection.ray.setWavelengthRange(settings["wavelength-min"], settings["wavelength-max"], settings["ray-count"]);
            $('label[for=ray-wavelength], input#ray-wavelength').hide();
            $('label[for=ray-count], input#ray-count').show();
            $('label[for=wavelength-min], input#wavelength-min').show();
            $('label[for=wavelength-max], input#wavelength-max').show();
        }

        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
        renderSettings();
    });

    $('#curve-selection').change(function () {
        $('input.wavelength,#multiplier').prop("disabled", this.value != "custom");

        let material;
        if (this.value == "custom") {
            if (selection.geometry) {
                material = selection.geometry.customMaterial;
            }
            else {
                material = basicMaterial;
            }
        }
        else {
            $('#multiplier').val(1);
            switch (this.value) {
                case "FK51A": material = materialFK51A; break;
                case "SF10": material = materialDenseFlintSF10; break;
                case "BK7": material = materialBK7; break;
                case "LASF9": material = materialLASF9; break;
                case "water": material = materialWater; break;
                case "ice": material = materialIce; break;
            }
        }
        if (selection.geometry) {
            selection.geometry.material = material;
        }
        else {
            environmentMaterial = material;
        }
        settings["multiplier"] = 1.0;
        selection.material = material;
        $('#380nm').val(material.refractiveIndex(380).toFixed(3));
        $('#400nm').val(material.refractiveIndex(400).toFixed(3));
        $('#500nm').val(material.refractiveIndex(500).toFixed(3));
        $('#600nm').val(material.refractiveIndex(600).toFixed(3));
        $('#700nm').val(material.refractiveIndex(700).toFixed(3));
        $('#740nm').val(material.refractiveIndex(740).toFixed(3));

        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
        renderSettings();
    });

    rayCanvasDiv = document.getElementById("canvas-container");
    let rayAppOptions = {
        antialias: true,
        resizeTo: rayCanvasDiv
    }
    rayApp = new PIXI.Application(rayAppOptions);
    rayCanvas = rayApp.view;
    rayCanvasDiv.appendChild(rayCanvas);
    rayApp.stage.addChild(rayGfx);


    curveCanvasDiv = document.getElementById("settings-canvas-container");
    let settingsAppOptions = {
        antialias: true,
        resizeTo: curveCanvasDiv,
    }
    settingsApp = new PIXI.Application(settingsAppOptions);
    curveCanvas = settingsApp.view;
    curveCanvasDiv.appendChild(curveCanvas);
    settingsApp.stage.addChild(settingsGfx);
    settingsApp.stage.addChild(canvasData.yLabel);
    settingsApp.stage.addChild(canvasData.xLabel);
    canvasData.labels.forEach(x => settingsApp.stage.addChild(x));

    rayApp.view.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    settingsApp.view.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    rayApp.view.addEventListener('mousemove', handleMouseMove);
    rayApp.view.addEventListener('mousedown', handleMouseDown);
    rayApp.view.addEventListener('mouseup', handleMouseUp);

    settingsApp.view.addEventListener('mousemove', handleMouseMoveSettings);
    settingsApp.view.addEventListener('mousedown', handleMouseDownSettings);
    settingsApp.view.addEventListener('mouseup', handleMouseUpSettings);

    canvasData.yLabel.angle = -90;
    canvasData.yLabel.position.x = 5;
    computeCurveCanvas();

    const centerX = rayApp.renderer.width / 2.0;
    const centerY = rayApp.renderer.height / 2.0;
    const triangle = new Triangle(0xffffff,
        [centerX - 150, centerY + 75],
        [centerX + 150, centerY + 75],
        [centerX, centerY - 75]);
    AddTraceGeometry(triangle);

    const ray = new LightRay([centerX - 230, centerY], normalize([1.0, 0.0]), lightWaves);
    ray.setWavelengthRange(380, 740, settings["ray-count"]);
    activeRays.push(ray);
    selectRay(ray);

    renderLines = traceRays(activeRays, tracedGeometries);

    selectGeometry(undefined);
});


function traceRays(rays, geometries) {
    let lines = [];

    for (const ray of rays) {
        lines = lines.concat(ray.tracePath(geometries.filter(x => x.colliding.size == 0)));
    }

    return lines;
}


(function ($, sr) {

    // debouncing function from John Hann
    // http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
    var debounce = function (func, threshold, execAsap) {
        var timeout;

        return function debounced() {
            var obj = this, args = arguments;
            function delayed() {
                if (!execAsap)
                    func.apply(obj, args);
                timeout = null;
            };

            if (timeout)
                clearTimeout(timeout);
            else if (execAsap)
                func.apply(obj, args);

            timeout = setTimeout(delayed, threshold || 100);
        };
    }
    // smartresize 
    jQuery.fn[sr] = function (fn) { return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

})(jQuery, 'smartresize');

$(window).smartresize(function () {
    rayApp.renderer.resize(rayCanvasDiv.clientWidth, rayCanvasDiv.clientHeight);
    settingsApp.renderer.resize(curveCanvasDiv.clientWidth, curveCanvasDiv.clientHeight);
    computeCurveCanvas();

    renderScene();
    renderSettings();
});
