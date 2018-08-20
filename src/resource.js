var res = {
    block_png : "res/block.png",
    white_box_png: "res/white_box.png",
    btn_on_png : "res/btn_on.png",
    btn_off_png : "res/btn_off.png",

    title_bgm : "res/bgm/bgm_4010027.m4a",
    game_bgm : "res/bgm/bgm_4010040.m4a",
    gameOver_bgm : "res/bgm/bgm_4010019.m4a",

    newGame_se : "res/se/se_30010.m4a",
    flick_se : "res/se/se_30004.m4a",
    blockAdded_se : "res/se/se_30009.m4a",
    menuOpened_se : "res/se/se_30015.m4a",
    buttonTap_se : "res/se/se_30009.m4a",

    gameOver_jingle: "res/se/me_4030001.m4a",

    volume_icon_png : "res/cmn_volume_icon.png",
    volume_gauge_png : "res/cmn_volume_gauge.png",
    volume_slider_png : "res/cmn_volume_bg.png"
};

var g_resources = [];
for (var i in res) {
    g_resources.push(res[i]);
}
