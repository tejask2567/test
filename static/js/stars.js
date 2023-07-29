var width = 1200,
    height = 500;

var projection = d3.geo.stereographic()
    .scale(1000)

var fixedProjection = d3.geo.stereographic()
    .scale(1000)
    .rotate([0, 0])

var canvas = d3.select("body").append("canvas")
    .attr("width", width)
    .attr("height", height)

var c = canvas.node().getContext("2d")

function getRetinaRatio() {
    var devicePixelRatio = window.devicePixelRatio || 1
    var backingStoreRatio = c.webkitBackingStorePixelRatio ||
        c.mozBackingStorePixelRatio ||
        c.msBackingStorePixelRatio ||
        c.oBackingStorePixelRatio ||
        c.backingStorePixelRatio || 1

    return devicePixelRatio / backingStoreRatio
}

var ratio = getRetinaRatio()
var scaledWidth = width * ratio
var scaledHeight = height * ratio

canvas.node().width = scaledWidth
canvas.node().height = scaledHeight
canvas
    .style("width", width + 'px')
    .style("height", height + 'px')

c.scale(ratio, ratio)

var path = d3.geo.path()
    .projection(projection)
    .context(c)

var graticule = d3.geo.graticule()
    .step([15, 15])

var bgRGB = d3.rgb('#113')

d3.json("http://bl.ocks.org/erohinaelena/raw/ec635d68e8bf55586d40/starData.json", function(error, data) {

    var geoConstellations = []
    var starsMag = []
    data = data.map(function(constellation) {
        constellation.stars = constellation.stars.filter(function(star) {
            if (star.mag < 6) starsMag.push(star.mag)
            return star.mag < 6
        })
        return constellation
    })
    var minMaxMag = d3.extent(starsMag)
    var opacityScale = d3.scale.linear()
        .domain(minMaxMag)
        .range([1, 0.4])

    var magScale = d3.scale.linear()
        .domain(minMaxMag)
        .range([2.7, 1.7])

    data.forEach(function (constellation) {
        var geometries = []

        constellation.stars.map(function (star) {
                var rgb = d3.rgb(star.color)
                var rgba = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + opacityScale(star.mag) + ')'

                geometries.push({
                    type: 'Point',
                    coordinates: [-star.ra, star.dec],
                    properties: {
                        color: rgba,
                        mag: magScale(star.mag)
                    }
                })
        })

        var lines = constellation.lines.map(function (line) {
            var p1 = [-line.ra1, line.dec1]
            var p2 = [-line.ra2, line.dec2]

            return [p1, p2]
        })

        geometries.push({
            type: "MultiLineString",
            coordinates: lines
        })

        if (constellation.name == 'Serpens'){
            var bound1 = constellation.boundary[0].map(function (coords) {
                return [-coords[0], coords[1]]
            })
            var bound2 = constellation.boundary[1].map(function (coords) {
                return [-coords[0], coords[1]]
            })
            geometries.push({
                type: "LineString",
                coordinates: bound1
            })
            geometries.push({
                type: "LineString",
                coordinates: bound2
            })
        } else {
            var boundLines = constellation.boundary.map(function (coords) {
                return [-coords[0], coords[1]]
            })
            geometries.push({
                type: "LineString",
                coordinates: boundLines
            })
        }
        geometries = {
            type: 'GeometryCollection',
            geometries: geometries
        }
        var geoConstellation = {
            type: 'Feature',
            geometry: geometries,
            properties: {
                name: constellation.name,
                zodiac: constellation.zodiac,
                center: d3.geo.centroid(geometries)
            }
        }
        geoConstellations.push(geoConstellation)
    })

    draw(geoConstellations, [30, -70])

    var raStart, decStart
    function getStart() {
        raStart  = projection.invert(d3.mouse(this))[0]
        decStart = fixedProjection.invert(d3.mouse(this))[1]
    }
    function move() {
        var raFinish = projection.invert(d3.mouse(this))[0]
        var decFinish = fixedProjection.invert(d3.mouse(this))[1]

        var raRotate = raFinish - raStart
        var decRotate = decFinish - decStart

        var rotate = projection.rotate()
        var newCenter = [rotate[0] + raRotate, rotate[1] + decRotate]

        draw(geoConstellations, newCenter)

        decStart = fixedProjection.invert(d3.mouse(this))[1]
    }
    var drag = d3.behavior.drag()
        .on("dragstart", getStart)
        .on("drag", move)
    canvas.call(drag)

}) 
function makeRadialGradient(x, y, r, color) {
    var radialgradient = c.createRadialGradient(x, y, 0, x, y, r)
    radialgradient.addColorStop(0.2, color)
    radialgradient.addColorStop(0.5,'rgba(' + bgRGB.r + ',' + bgRGB.g + ',' + bgRGB.b + ',0)')
    radialgradient.addColorStop(0.5,'rgba(' + bgRGB.r + ',' + bgRGB.g + ',' + bgRGB.b + ',1)')
    radialgradient.addColorStop(1,'rgba(' + bgRGB.r + ',' + bgRGB.g + ',' + bgRGB.b + ',0)')
    c.fillStyle = radialgradient
}

function distance(p) {
    var center = [width / 2, height / 2]
    var xRotate = center[0] - p[0]
    var yRotate = center[1] - p[1]

    return Math.sqrt(Math.pow(xRotate, 2) + Math.pow(yRotate, 2))
}
function draw(constellations, center) {

    var min = 0,
        minDistance = distance(projection(constellations[0].properties.center))

    if (center) projection.rotate(center)

    c.clearRect(0, 0, width, height)
    c.strokeStyle = "#fff"
    c.lineWidth = .1
    c.beginPath(), path(graticule()), c.stroke()
    c.lineWidth = .4
    c.beginPath(), path({type: "LineString", coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]}), c.stroke()
    c.strokeStyle = "#f2f237"
    c.beginPath(), path({type: "LineString", coordinates: [[-180, 0], [-90, 23.26], [0, 0], [90, -23.26], [180, 0]]}), c.stroke()

    constellations.forEach(function(constellation, i) {
        var currentDistance = distance(projection(constellations[i].properties.center))
        if (currentDistance < minDistance) {
            min = i
            minDistance = currentDistance
        }
        constellation.geometry.geometries.forEach(function(geo) {
            if (geo.type == 'Point') {
                makeRadialGradient(
                    projection(geo.coordinates)[0],
                    projection(geo.coordinates)[1],
                    geo.properties.mag,
                    geo.properties.color)
                path.pointRadius([geo.properties.mag])
                c.beginPath(), path(geo), c.fill();
            } else if (geo.type == 'LineString') {
                c.strokeStyle = '#000'
                c.beginPath(), path(geo),c.stroke()
            } else if (geo.type == 'MultiLineString') {
                c.strokeStyle = (constellation.properties.zodiac)? '#f2f237':"#999"
                c.beginPath(), path(geo), c.stroke();
            }
        })
    })
    c.strokeStyle = "#f00"
    c.lineWidth = 1.2
    constellations[min].geometry.geometries.forEach(function(geo) {
        if (geo.type == 'LineString') {
            c.beginPath(), path(geo), c.stroke()
        }
    })
    c.fillStyle = '#fff'
    c.textAlign = "center"
    c.font = "18px sans-serif"
    c.fillText(constellations[min].properties.name, width / 2, 280)
}