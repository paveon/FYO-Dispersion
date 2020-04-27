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
            ray: new LightRay(point, ray.dir, ray.wavelengths),
            TIR: false
        });
    }
    else {
        for (const wavelength of ray.wavelengths) {
            const n1 = material1.refractiveIndex(wavelength.length);
            const n2 = material2.refractiveIndex(wavelength.length);
            const mu = math.divide(n1, n2);
            const sin2Phi = math.pow(mu, 2) * (1 - math.pow(cosI, 2));
            if (sin2Phi > 1.0) {
                if (!reflectDir) reflectDir = math.add(ray.dir, math.multiply(math.multiply(2.0, cosI), normal));
                rays.push({
                    ray: new LightRay(point, reflectDir, [wavelength]),
                    TIR: true
                });
            }
            const refractDir = math.add(math.multiply(mu, ray.dir),
                math.multiply((math.subtract(mu * cosI, math.sqrt(1 - sin2Phi))), normal));
            rays.push({
                ray: new LightRay(point, refractDir, [wavelength]),
                TIR: false
            });
        }
    }

    return rays;
}


class LightRay {
    constructor(origin, dir, wavelengths) {
        this.origin = origin;
        this.dir = dir;
        this.normal = getNormal(this.dir);
        this.wavelengths = wavelengths;
        this.inside = false;
        this.lastEdgeIdx = undefined;

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
        this.wavelengths = [{
            length: wl,
            color: PIXI.utils.rgb2hex(wavelengthToColor(wl))
        }];
    }

    setWavelengthRange(min, max, count) {
        const stepSize = (max - min) / count;
        this.wavelengths = Array(count).fill().map(function (_, idx) {
            const wl = min + (idx * stepSize);
            return {
                length: wl,
                color: PIXI.utils.rgb2hex(wavelengthToColor(wl))
            };
        });
    }

    color() {
        return this.wavelengths.length > 1 ? 0xffffff : this.wavelengths[0].color;
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
        drawPoint(this.origin, gfx, 6, this.selected ? 0x0000ff : 0xff0000);
        const arrowWingsLength = 7;
        const p1 = math.add(this.arrowOffset, math.multiply(this.normal, arrowWingsLength));
        const p2 = math.subtract(this.arrowOffset, math.multiply(this.normal, arrowWingsLength));
        drawLine(gfx, 0x00ff00, this.arrowEndPoint, p1);
        drawLine(gfx, 0x00ff00, this.arrowEndPoint, p2);
        // gfx.drawCircle(...this.arrowEndPoint, 15);
    }


    getSegment(length) {
        let endPoint = math.add(this.origin, math.multiply(this.dir, length));
        return new Line(0x91CF46, this.origin, endPoint);
    }

    tracePath(geometries) {
        const ray = this;
        let intersection = undefined;
        for (let i = 0; i < geometries.length; i++) {
            const result = geometries[i].rayIntersection(ray);
            if (intersection != undefined) {
                if (result != undefined && result.t < intersection.t) {
                    intersection = result;
                }
            } else {
                intersection = result;
            }
        }

        if (intersection) {
            const remainingGeometries = geometries.filter(g => g !== intersection.geometry);

            const result = intersection.geometry.solveRay(ray, intersection);
            let lineSegments = result.lineSegments;
            //TODO: ignore the same geometry only for next trace
            //Recursively trace emergent rays
            for (const emergentRay of result.emergentRays) {
                lineSegments = lineSegments.concat(emergentRay.tracePath(remainingGeometries));
            }

            return lineSegments;
        }
        else {
            // No intersection found, TODO: maybe fix this and find intersection with canvas boundaries
            // console.log("No intersection");
            const rayColor = this.wavelengths.length > 1 ? 0xffffff : this.wavelengths[0].color;
            const endPoint = math.add(this.origin, math.multiply(this.dir, 1000.0));
            return [new Line(rayColor, this.origin, endPoint)];
        }
    }
}


function drawPoint(point, gfx, size = 5, color = 0xe74c3c, edgeColor = 0xffff00) {
    gfx.lineStyle(1, edgeColor, 1);
    gfx.beginFill(color); // Red
    gfx.drawCircle(point[0], point[1], size);
    gfx.endFill();
}

function drawLine(gfx, color, p1, p2) {
    gfx.lineStyle(2, color, 1);
    gfx.moveTo(...p1);
    gfx.lineTo(...p2);
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

        console.log(`Undefined refraction index for ${wavelength}nm wavelength, defaulting to 1.0`);
        return 1.0;
    }
}


class Geometry {
    constructor(drawColor) {
        this.color = drawColor;
        this.hovered = false;
        this.selected = false;
        this.material = undefined;
    }

    rayIntersection(ray, gfx) { }


    translate(delta, _mousePos) {
        this.vertices = this.vertices.map(x => math.add(x, delta));
    }


    draw(gfx) {
        // console.log(`[Draw] ${this.constructor.name}`);
        if (settings["debugOn"]) {
            this.debugDraw(gfx);
        }

        let color;
        let lineWidth = 2;
        if (this.hovered && this.selected) {
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
                    emergentRays.push(rayData.ray);
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
        this.material = new Material();

        this.height = height;
        this.width = width;
        this.vertices = [
            v,
            math.add(v, [width, 0]),
            math.add(v, [width, height]),
            math.add(v, [0, height])
        ];
        this.normals = [[0.0, -1.0], [1.0, 0.0], [0.0, 1.0], [-1.0, 0.0]];
    }

    getWidth() { return this.width; }
    getHeight() { return this.height; }

    setWidth(value) {
        this.width = value;
        this.vertices[1] = math.add(this.vertices[0], [this.width, 0]);
        this.vertices[2] = math.add(this.vertices[0], [this.width, this.height]);
    }

    setHeight(value) {
        this.height = value;
        this.vertices[2] = math.add(this.vertices[0], [this.width, this.height]);
        this.vertices[3] = math.add(this.vertices[0], [0, this.height]);
    }
}

class Triangle extends Geometry {
    static idCounter = 0;

    constructor(drawColor, v1, v2, v3) {
        super(drawColor);
        this.id = (Triangle.idCounter++);
        this.material = new Material();
        this.vertices = [v1, v2, v3];
        this.normals = [
            getNormal(math.subtract(v2, v1)),
            getNormal(math.subtract(v3, v2)),
            getNormal(math.subtract(v1, v3))
        ];
        this.apexAngle = Math.PI - math.acos(math.dot(this.normals[1], this.normals[2]));
        this.height = (math.distance(v1, v2) / 2.0) / Math.tan(this.apexAngle / 2.0);
    }

    // getAngle();
    // getHeight();

    setAngle(angle) {

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

        switch (geometry.constructor) {
            case Rectangle:
                $('#triangle-div').hide();
                $('#rectangle-div').show();
                $('#rect-width').val(geometry.getWidth());
                $('#rect-height').val(geometry.getHeight());
                break;

            case Triangle:
                $('#rectangle-div').hide();
                $('#triangle-div').show();
                $('#triangle-angle').val(90);
                $('#triangle-height').val(50);
                break;
        }
    } else {
        setNumberInputs(environmentMaterial);
        selection.material = environmentMaterial;
        $('#geometryType').text("Dispersion curve: environment");
        $('#rectangle-div').hide();
        $('#triangle-div').hide();
    }

    renderSettings();
    renderScene();
}


function selectRay(ray) {
    selectObject("ray", ray);
    $("#ray-angle").val(-radToDeg(ray.getAngle()).toFixed(2));

    renderSettings();
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
    "ray-count": 6
}


let leftMouseDown = false;
let lastMousePos = [0, 0];

let activeRays = [];
let tracedGeometries = [];
let renderGeometries = [];
let renderLines = [];

let canvasDiv = null;
let canvas = null;
let app = null;
let gfx = null;

let canvas2 = null;
let canvasDiv2 = null;
let settingsApp = null;
let settingsGfx = null;

const environmentCurvePoints = [
    [380, 1.0],
    [400, 1.0],
    [500, 1.0],
    [600, 1.0],
    [700, 1.0],
    [740, 1.0]
];

const environmentMaterial = new Material(environmentCurvePoints);

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

const spectrumWidth = 740 - 380;


// const whitelightWavelengths = [380.0, 400.0, 500.0, 600.0, 700.0, 740.0];
const whitelightWavelengths = [380.0, 400.0, 500.0, 600.0, 700.0, 740.0].map(x => {
    return {
        length: x,
        color: PIXI.utils.rgb2hex(wavelengthToColor(x))
    }
});

function renderScene() {
    app.stage.removeChildren()
    app.renderer.clear();

    gfx = new PIXI.Graphics();
    app.stage.addChild(gfx);

    for (const geometry of renderGeometries) {
        geometry.draw(gfx);
    }

    for (const line of renderLines) {
        line.draw(gfx);
    }

    for (const ray of activeRays) {
        ray.draw(gfx);
    }

    app.render();
    app.stop();
}


function renderSettings() {
    settingsApp.stage.removeChildren()
    settingsApp.renderer.clear();

    settingsGfx = new PIXI.Graphics();
    settingsApp.stage.addChild(settingsGfx);

    const width = canvas2.width;
    const height = canvas2.height;
    const offsetY = canvas2.height / 6;
    const spectrumWidth = 740 - 380;

    const maxN = 2.5;
    const minN = 1.0;
    const deltaN = maxN - minN;

    const yLabel = new PIXI.Text("refractive index - n", { fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, align: 'center' });
    yLabel.angle = -90;
    yLabel.position.x = 5;
    yLabel.position.y = (height / 2) + (yLabel.width / 2);
    settingsApp.stage.addChild(yLabel);

    let lastPoint = undefined;
    for (const wavelength of whitelightWavelengths) {
        const offsetX = ((wavelength.length - 380) / spectrumWidth) * (width - 80);
        const p1 = [offsetX + 40, offsetY]
        const p2 = [offsetX + 40, height - offsetY];
        drawLine(settingsGfx, wavelength.color, p1, p2);

        const labelText = wavelength.length.toString();
        const label = new PIXI.Text(labelText, { fontFamily: 'Arial', fontSize: 11, fill: 0xffffff, align: 'center' });
        label.angle = 90;
        label.position.x = p2[0] + label.height / 2;
        label.position.y = p2[1] + label.width / 2;
        settingsApp.stage.addChild(label);

        const n = selection.material.curvePoints.get(wavelength.length);
        const rectCenterX = offsetX + 40;
        const rectCenterY = height - offsetY - ((n - minN) / deltaN) * (height - 2 * offsetY);
        const rectCenter = [rectCenterX, rectCenterY];
        settingsGfx.beginFill(0xffffff);
        settingsGfx.lineStyle(1, 0xff0000, 0);
        settingsGfx.drawRect(rectCenterX - 5, rectCenterY - 5, 10, 10);
        settingsGfx.endFill();

        if (lastPoint != undefined) {
            drawLine(settingsGfx, 0xffffff, lastPoint, rectCenter);
        }
        lastPoint = rectCenter;
    }

    drawLine(settingsGfx, 0xffffff, [25, height - offsetY], [width, height - offsetY]);
    drawLine(settingsGfx, 0xffffff, [25, height - offsetY], [25, offsetY - 20]);


    settingsApp.render();
    settingsApp.stop();
}


let lastMousePosSettings = [0, 0];
let leftMouseDownSettings = false;
let selectedWavelength = undefined;

const maxN = 2.5;
const minN = 1.0;
const deltaN = maxN - minN;

function handleMouseMoveSettings(e) {
    const point = [e.offsetX, e.offsetY];
    const width = canvas2.width;
    const height = canvas2.height;
    const relativeOffsetY = canvas2.height / 6;
    const heightDelta = (height - 2 * relativeOffsetY);

    if (selectedWavelength && leftMouseDownSettings) {
        // Geometry drag
        const y = Math.max(0, Math.min((height - point[1] - relativeOffsetY) / heightDelta, 1.0));
        const newN = (y * deltaN) + minN;
        selection.material.curvePoints.set(selectedWavelength, newN);
        $('input#' + selectedWavelength.toString() + "nm").val(newN.toFixed(3));

        renderSettings();
    }
    else {
        let hoveredWavelength = undefined;
        for (let [wavelength, n] of selection.material.curvePoints) {
            const y = height - relativeOffsetY - ((n - minN) / deltaN) * heightDelta;
            const x = ((wavelength - 380) / spectrumWidth) * (width - 80) + 40;

            const d = math.distance([x, y], point);
            if (d < 10) {
                hoveredWavelength = wavelength;
                break;
            }
        }

        if (hoveredWavelength) {
            if (!selectedWavelength) {
                // Entering geometry, redraw
                canvas2.style.cursor = "pointer";
                selectedWavelength = hoveredWavelength;
            }
        }
        else {
            // No geometry is currently hovered
            if (selectedWavelength) {
                // Leaving geometry, redraw
                canvas2.style.cursor = "default";
                selectedWavelength = undefined;
            }
        }
    }

    lastMousePos = point;
}


function handleMouseDownSettings(e) {
    if (selectedWavelength) {
        switch (e.which) {
            case 1:
                canvas2.style.cursor = "move";
                leftMouseDownSettings = true;
                break; // Left
        }
    }
}

function handleMouseUpSettings(e) {
    switch (e.which) {
        case 1:
            if (selectedWavelength) {
                // Geometry drag end
                renderLines = traceRays(activeRays, tracedGeometries);
                canvas2.style.cursor = "pointer";
                renderScene();
            }
            else {
                canvas2.style.cursor = "default";
            }
            leftMouseDownSettings = false;
            break;
    }
}



function handleMouseMove(e) {
    const point = [e.offsetX, e.offsetY];
    if (hoveredObject && leftMouseDown) {
        // Geometry drag
        const delta = math.subtract(point, lastMousePos);
        hoveredObject.translate(delta, point);
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
                canvas.style.cursor = "pointer";
                hoveredObject = object;
                hoveredObject.hovered = true;
                renderScene();
            }
        }
        else {
            // No geometry is currently hovered
            if (hoveredObject) {
                // Leaving geometry, redraw
                canvas.style.cursor = "default";
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
                canvas.style.cursor = "move";
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
                canvas.style.cursor = "pointer";
                renderScene();
            }
            else {
                canvas.style.cursor = "default";
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

/*
 * Registers callbacks when the page load
 */
document.addEventListener("DOMContentLoaded", function () {
    $("#ray-count").val(settings["ray-count"]);
    $("#wavelength-min").val(settings["wavelength-min"]);
    $("#wavelength-max").val(settings["wavelength-max"]);

    $(".wavelength").focusout(function (e) {
        $(this).val(selection.material.curvePoints.get(parseInt(this.id)).toFixed(3));
    });

    $("#multiplier").focusout(function (e) { $(this).val(settings["multiplier"].toFixed(3)); });

    $("#ray-count").focusout(function (e) { $(this).val(settings["ray-count"]); });
    $("#ray-angle").focusout(function (e) { $(this).val(-radToDeg(selection.ray.getAngle()).toFixed(2)); });

    $("#wavelength-min").focusout(function (e) { $(this).val(settings["wavelength-min"]); });
    $("#wavelength-max").focusout(function (e) { $(this).val(settings["wavelength-max"]); });

    $("#rect-width").focusout(function (e) { 
        if (selection.geometry) {
            $(this).val(selection.geometry.getWidth());
        }
    });
    $("#rect-height").focusout(function (e) { 
        if (selection.geometry) {
            $(this).val(selection.geometry.getHeight()); 
        }
    });

    $("#triangle-angle").focusout(function (e) { 
        if (selection.geometry) {
            $(this).val(selection.geometry.getAngle());
        }
    });
    $("#triangle-height").focusout(function (e) { 
        if (selection.geometry) {
            $(this).val(selection.geometry.getHeight()); 
        }
    });

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
        selection.geometry.setAngle(Math.max(15, Math.min(parseInt(value), 90)));
    }));
    $("#triangle-height").on('input', e => processInput(e, function (value) {
        selection.geometry.setHeight(Math.max(50, Math.min(parseInt(value), 300)));
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
    }));

    $('#light-wavelength').on('input', e => processInput(e, function (value) {
        value = Math.max(settings["wavelength-min"], Math.min(value, settings["wavelength-max"]));
        selection.ray.setWavelength(value);
    }));

    $('#monochromatic-div').hide();
    $('#monochromatic').change(function () {
        const wavelengthInput = $('#light-wavelength');
        if (this.checked) {
            selection.ray.wavelengths = [whitelightWavelengths[0]];
            wavelengthInput.val(whitelightWavelengths[0].length);
            $('#chromatic-div').hide();
            $('#monochromatic-div').show();
        }
        else {
            selection.ray.setWavelengthRange(settings["wavelength-min"], settings["wavelength-max"], settings["ray-count"]);
            $('#chromatic-div').show();
            $('#monochromatic-div').hide();
        }

        renderLines = traceRays(activeRays, tracedGeometries);
        renderScene();
        renderSettings();
    });

    // const allInputs = document.getElementsByTagName("input");
    // for (const input of allInputs) {
    //     input.addEventListener("input", setOption);
    // }

    canvasDiv = document.getElementById("canvas-container");
    let pixiOptions = {
        forceFXAA: true,
        antialias: true,
        resizeTo: canvasDiv
    }
    app = new PIXI.Application(pixiOptions);
    canvas = app.view;
    canvasDiv.appendChild(canvas);


    canvasDiv2 = document.getElementById("settings-canvas-container");
    let pixiOptions2 = {
        // forceFXAA: true,
        // antialias: true,
        resizeTo: canvasDiv2,
    }
    settingsApp = new PIXI.Application(pixiOptions2);
    canvas2 = settingsApp.view;
    canvasDiv2.appendChild(canvas2);

    app.view.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // settingsApp.view.addEventListener('contextmenu', (e) => {
    //     e.preventDefault();
    // });

    app.view.addEventListener('mousemove', handleMouseMove);
    app.view.addEventListener('mousedown', handleMouseDown);
    app.view.addEventListener('mouseup', handleMouseUp);

    settingsApp.view.addEventListener('mousemove', handleMouseMoveSettings);
    settingsApp.view.addEventListener('mousedown', handleMouseDownSettings);
    settingsApp.view.addEventListener('mouseup', handleMouseUpSettings);

    const centerX = app.renderer.width / 2.0;
    const centerY = app.renderer.height / 2.0;
    const triangle = new Triangle(0x91CF46,
        [centerX - 150, centerY],
        [centerX + 150, centerY],
        [centerX, centerY - 150]);

    const rect = new Rectangle(0x91CF46, [centerX - 100, centerY - 100], 200, 200);

    renderGeometries.push(triangle);
    tracedGeometries.push(triangle);

    tracedGeometries.push(rect);
    renderGeometries.push(rect);

    const ray = new LightRay([centerX - 230, centerY], normalize([1.0, -0.5]), whitelightWavelengths);
    activeRays.push(ray);
    selectRay(ray);

    renderLines = traceRays(activeRays, tracedGeometries);
    
    selectGeometry(undefined);
});


function traceRays(rays, geometries) {
    let lines = [];
    for (const ray of rays) {
        lines = lines.concat(ray.tracePath(geometries));
    }

    return lines;
}


function setOption(e) {
    element = e.target;
    if (element.getAttribute("type") == "checkbox") {
        settings[element.id] = element.checked;
    }
    else {
        let value = parseFloat(element.value);
        if (!isNaN(value)) {
            settings[element.id] = value;
        }
    }

    renderScene();
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
    app.renderer.resize(canvasDiv.clientWidth, canvasDiv.clientHeight);
    settingsApp.renderer.resize(canvasDiv2.clientWidth, canvasDiv2.clientHeight);
    console.log("TEST");
    renderScene();
    renderSettings();
});


// Check/uncheck the node checkbox
function toggleCheckbox(node) {
    node.checked = !node.checked;
}


/*
 * Register a callback which handles all key presses
 */
// window.addEventListener("keydown", function (e) {
//     //console.log(e)
//     if(e.target.nodeName == "INPUT")
//         return;
//     if(e["key"] == "+" || e["key"] == "-")
//     {
//         let ratio = e["key"] == "+" ? 2.0 : 0.5;
//         let oldScale =  app.stage.scale["x"]
//         let newScale = oldScale*ratio
//         //console.log(newScale)
//         app.stage.setTransform(0,0,newScale, newScale)
//     }
//     if(e["key"] == "Enter")
//         document.getElementById("raysCount").value = parseInt(document.getElementById("raysCount").value)+1
//     if(e["key"] == "a")
//         toggleCheckbox(document.getElementById("showOpticalAxis"))
//     if(e["key"] == "m")
//         toggleCheckbox(document.getElementById("markSphericalAberration"))
//     if(e["key"] == "p")
//         toggleCheckbox(document.getElementById("shouldBeSource"))
//     if(e["key"] == "c")
//         toggleCheckbox(document.getElementById("isChromaticModeOn"))
//     if(e["key"] == "l")
//         toggleCheckbox(document.getElementById("showLens"))
//     if(e["key"] == "f")
//     {
//         toggleCheckbox(document.getElementById("fullscreen"))
//     }
//     renderWithUserArguments()
// });
