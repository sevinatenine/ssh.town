import db from "./dataManager.js";
import chalk from "chalk";

function getArea(area) {
    var area = db.areas[area];
    return area;
}

function getSpawn(area) {
    return getArea(area).spawn;
}

function getRoom(area, x, y) {
    var areaDesc = getArea(area);
    var room = areaDesc.tiles.find(e => (e.x === x && e.y === y));
    if (!room) return null;
    var type = areaDesc.tileTypes[room.type];
    room.name = type.name;
    room.description = type.description;
    room.char = chalk[type.color](type.symbol);
    if (type.portalTo) room.portalTo = type.portalTo;
    if (type.portalBack) room.portalBack = type.portalBack;
    return room;
}

export {
    getRoom,
    getArea,
    getSpawn
};