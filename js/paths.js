const PresetPaths = {
    circle: {
        name: '圆形',
        generate: (cx = 400, cy = 300, r = 150) => {
            const points = [];
            const segments = 12;
            for (let i = 0; i < segments; i++) {
                const angle1 = (i / segments) * Math.PI * 2 - Math.PI / 2;
                const angle2 = ((i + 0.5) / segments) * Math.PI * 2 - Math.PI / 2;
                const angle3 = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2;
                
                const x1 = cx + Math.cos(angle1) * r;
                const y1 = cy + Math.sin(angle1) * r;
                const x2 = cx + Math.cos(angle2) * r;
                const y2 = cy + Math.sin(angle2) * r;
                const x3 = cx + Math.cos(angle3) * r;
                const y3 = cy + Math.sin(angle3) * r;
                
                const handleLen = r * 0.5522847498;
                const h1a = angle1 + Math.PI / 2;
                const h1b = angle3 - Math.PI / 2;
                
                const cp1x = x1 + Math.cos(h1a) * handleLen * 0.5;
                const cp1y = y1 + Math.sin(h1a) * handleLen * 0.5;
                const cp2x = x3 + Math.cos(h1b) * handleLen * 0.5;
                const cp2y = y3 + Math.sin(h1b) * handleLen * 0.5;
                
                if (i === 0) {
                    points.push({
                        x: x1, y: y1,
                        type: 'bezier',
                        cpIn: null, cpOut: null
                    });
                }
                
                points.push({
                    x: x3, y: y3,
                    type: 'bezier',
                    cpIn: { x: cp2x, y: cp2y },
                    cpOut: null
                });
                
                if (points.length > 1) {
                    points[points.length - 2].cpOut = { x: cp1x, y: cp1y };
                }
            }
            return points;
        }
    },
    
    heart: {
        name: '爱心',
        generate: (cx = 400, cy = 300, scale = 1) => {
            const heartPoints = [
                { x: 0, y: -40 },
                { x: 40, y: -80 },
                { x: 80, y: -60 },
                { x: 60, y: -20 },
                { x: 40, y: 10 },
                { x: 0, y: 60 },
                { x: -40, y: 10 },
                { x: -60, y: -20 },
                { x: -80, y: -60 },
                { x: -40, y: -80 },
                { x: 0, y: -40 }
            ];
            
            return heartPoints.map((p, i) => ({
                x: cx + p.x * scale,
                y: cy + p.y * scale,
                type: 'bezier',
                cpIn: i > 0 ? {
                    x: cx + (p.x + heartPoints[i - 1].x) / 2 * scale,
                    y: cy + (p.y + heartPoints[i - 1].y) / 2 * scale
                } : null,
                cpOut: null
            }));
        }
    },
    
    star: {
        name: '星形',
        generate: (cx = 400, cy = 300, outerR = 150, innerR = 60, points = 5) => {
            const result = [];
            const totalPoints = points * 2;
            
            for (let i = 0; i <= totalPoints; i++) {
                const angle = (i / totalPoints) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 === 0 ? outerR : innerR;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                
                result.push({
                    x, y,
                    type: 'line',
                    cpIn: null,
                    cpOut: null
                });
            }
            
            return result;
        }
    },
    
    wave: {
        name: '波浪',
        generate: (startX = 100, startY = 300, amplitude = 80, frequency = 0.015, length = 600) => {
            const points = [];
            const segments = 30;
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const x = startX + t * length;
                const y = startY + Math.sin(t * Math.PI * 4) * amplitude;
                
                const cpOffset = length / segments * 0.4;
                
                points.push({
                    x, y,
                    type: 'bezier',
                    cpIn: i > 0 ? {
                        x: x - cpOffset,
                        y: y
                    } : null,
                    cpOut: i < segments ? {
                        x: x + cpOffset,
                        y: y
                    } : null
                });
            }
            
            return points;
        }
    },
    
    spiral: {
        name: '螺旋',
        generate: (cx = 400, cy = 300, startR = 10, endR = 180, turns = 3, segmentsPerTurn = 12) => {
            const points = [];
            const totalSegments = turns * segmentsPerTurn;
            
            for (let i = 0; i <= totalSegments; i++) {
                const t = i / totalSegments;
                const r = startR + (endR - startR) * t;
                const angle = t * Math.PI * 2 * turns - Math.PI / 2;
                
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                
                const nextAngle = angle + Math.PI * 2 * turns / totalSegments * 0.5;
                const nextR = r + (endR - startR) / totalSegments * 0.5;
                const nextX = cx + Math.cos(nextAngle) * nextR;
                const nextY = cy + Math.sin(nextAngle) * nextR;
                
                points.push({
                    x, y,
                    type: 'bezier',
                    cpIn: null,
                    cpOut: { x: nextX, y: nextY }
                });
                
                if (i > 0) {
                    const prevAngle = angle - Math.PI * 2 * turns / totalSegments * 0.5;
                    const prevR = r - (endR - startR) / totalSegments * 0.5;
                    points[i].cpIn = {
                        x: cx + Math.cos(prevAngle) * prevR,
                        y: cy + Math.sin(prevAngle) * prevR
                    };
                }
            }
            
            return points;
        }
    },
    
    signature: {
        name: '签名笔迹',
        generate: (startX = 150, startY = 350) => {
            const sigPoints = [
                { x: 0, y: 0 },
                { x: 30, y: -40 },
                { x: 60, y: -20 },
                { x: 90, y: 20 },
                { x: 120, y: -30 },
                { x: 150, y: 0 },
                { x: 180, y: 30 },
                { x: 210, y: 10 },
                { x: 240, y: -25 },
                { x: 270, y: 5 },
                { x: 300, y: 35 },
                { x: 330, y: 15 },
                { x: 360, y: -15 },
                { x: 390, y: -5 },
                { x: 420, y: 25 },
                { x: 450, y: 0 },
                { x: 480, y: -30 },
                { x: 510, y: -10 },
                { x: 540, y: 20 }
            ];
            
            return sigPoints.map((p, i) => {
                const smooth = 30;
                return {
                    x: startX + p.x,
                    y: startY + p.y,
                    type: 'bezier',
                    cpIn: i > 0 ? {
                        x: startX + p.x - smooth * 0.4,
                        y: startY + p.y
                    } : null,
                    cpOut: i < sigPoints.length - 1 ? {
                        x: startX + p.x + smooth * 0.4,
                        y: startY + p.y
                    } : null
                };
            });
        }
    }
};

function pathPointsToD(points, closed = false) {
    if (!points || points.length === 0) return '';
    
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        if (prev.type === 'bezier' && curr.type === 'bezier' && prev.cpOut && curr.cpIn) {
            d += ` C ${prev.cpOut.x.toFixed(2)} ${prev.cpOut.y.toFixed(2)},`;
            d += ` ${curr.cpIn.x.toFixed(2)} ${curr.cpIn.y.toFixed(2)},`;
            d += ` ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
        } else if (prev.type === 'bezier' && prev.cpOut) {
            d += ` Q ${prev.cpOut.x.toFixed(2)} ${prev.cpOut.y.toFixed(2)},`;
            d += ` ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
        } else {
            d += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
        }
    }
    
    if (closed) {
        d += ' Z';
    }
    
    return d;
}

function getSegmentInfo(points) {
    const segments = [];
    let totalLength = 0;
    
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        let segPoints;
        let segLengths = [];
        let segTotalLength = 0;
        
        if (prev.type === 'bezier' && curr.type === 'bezier' && prev.cpOut && curr.cpIn) {
            segPoints = getCubicBezierPoints(prev, curr);
        } else if (prev.type === 'bezier' && prev.cpOut) {
            segPoints = getQuadraticBezierPoints(prev, curr);
        } else {
            segPoints = [prev, curr];
        }
        
        for (let j = 1; j < segPoints.length; j++) {
            const len = Math.hypot(segPoints[j].x - segPoints[j-1].x, segPoints[j].y - segPoints[j-1].y);
            segLengths.push(len);
            segTotalLength += len;
        }
        
        segments.push({
            index: i - 1,
            points: segPoints,
            lengths: segLengths,
            totalLength: segTotalLength,
            startLength: totalLength
        });
        
        totalLength += segTotalLength;
    }
    
    return { segments, totalLength };
}

function getPointOnPath(points, t) {
    if (!points || points.length < 2) return { x: 0, y: 0, angle: 0 };
    
    const { segments, totalLength } = getSegmentInfo(points);
    const targetLength = Math.max(0, Math.min(1, t)) * totalLength;
    
    for (const seg of segments) {
        if (seg.startLength + seg.totalLength >= targetLength) {
            const localTarget = targetLength - seg.startLength;
            let accumulated = 0;
            
            for (let j = 0; j < seg.lengths.length; j++) {
                if (accumulated + seg.lengths[j] >= localTarget) {
                    const f = seg.lengths[j] > 0 ? (localTarget - accumulated) / seg.lengths[j] : 0;
                    const p1 = seg.points[j];
                    const p2 = seg.points[j + 1];
                    
                    const x = p1.x + (p2.x - p1.x) * f;
                    const y = p1.y + (p2.y - p1.y) * f;
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                    
                    return { x, y, angle };
                }
                accumulated += seg.lengths[j];
            }
            
            const lastPoint = seg.points[seg.points.length - 1];
            const prevPoint = seg.points[seg.points.length - 2];
            const angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x) * 180 / Math.PI;
            return { x: lastPoint.x, y: lastPoint.y, angle };
        }
    }
    
    const last = points[points.length - 1];
    return { x: last.x, y: last.y, angle: 0 };
}

function getPathTotalLength(points) {
    if (!points || points.length < 2) return 0;
    
    const { totalLength } = getSegmentInfo(points);
    return totalLength;
}

function getCubicBezierPoints(p0, p3) {
    const p1 = p0.cpOut;
    const p2 = p3.cpIn;
    const points = [];
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        
        const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
        const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
        
        points.push({ x, y });
    }
    
    return points;
}

function getQuadraticBezierPoints(p0, p2) {
    const p1 = p0.cpOut;
    const points = [];
    const steps = 15;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        
        const x = mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x;
        const y = mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y;
        
        points.push({ x, y });
    }
    
    return points;
}
