import { lib, game, ui, get, ai, _status } from "../../../noname.js";
//import { menuUpdates } from '../../../noname/ui/create/menu/index.js'
export async function content(config, pack) {
    game.openAnimation = function (name, time, bool) {
        if (game.getFileList) {
            if (game.me && game.me.name) var gameOn = true;
            if (gameOn) game.pause();
            ui.arena.hide();
            if (!bool) ui.backgroundMusic.pause();
            let video = document.createElement("video");
            video.setAttribute("autoplay", "autoplay");
            video.src = lib.assetURL + "extension/五花米线/video" + name + ".mp4?t=" + Date.now();
            document.body.appendChild(video);
            video.style.margin = "0";
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.left = "0px";
            video.style.top = "0px";
            video.style.position = "absolute";
            video.style.zIndex = 0;
            video.style.backgroundSize = "cover";
            video.style.objectFit = "fill";
            let time1 = setTimeout(function () {
                if (time) {
                    document.body.removeChild(video);
                    if (gameOn) game.resume();
                    ui.arena.show();
                    ui.backgroundMusic.play();
                }
            }, time + 300);
            video.onended = () => {
                if (typeof time1 != "undefined") clearInterval(time1);
                document.body.removeChild(video);
                ui.arena.show();
                game.resume();
            };
            video.addEventListener("loadedmetadata", function () {
                this.onclick = function () {
                    this.currentTime = this.duration;
                    if (typeof time1 != "undefined") clearInterval(time1);
                };
            });
            return video;
        }
    };
}
