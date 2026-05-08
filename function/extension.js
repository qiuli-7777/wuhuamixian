import { lib, game, ui, get, ai, _status } from "../../noname.js";
import { config } from './js/config.js';
import { precontent } from './js/precontent.js';
import { content } from './js/content.js';
import { arenaReady } from './js/arenaReady.js'
import update from './function/update.js';
export const type = "extension";

lib.init.css(lib.assetURL + "extension/五花米线", "extension");

const extensionInfo = await lib.init.promises.json(`${lib.assetURL}extension/五花米线/info.json`);
let extensionPackage={
    name: "五花米线",
    arenaReady: arenaReady,
    content: content,
    prepare: function () {},
    precontent: precontent,
    config: config,
    help: {},
    package: {},
    files: { character: [], card: [], skill: [], audio: [] },
    connect: false,
    editable:false,
};
Object.keys(extensionInfo).forEach((key) => {
	extensionPackage.package[key] = extensionInfo[key];
});
export default extensionPackage;
