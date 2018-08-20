var TitleScene = cc.Scene.extend({
    onEnter: function () {
        this._super();
        var titleRootLayer = new TitleRootLayer();
        this.addChild(titleRootLayer);
    }
});

var TitleRootLayer = cc.Layer.extend({
    buttonLayer: null,
    logoLayer: null,
    hiscoreLayer: null,
    _audioEngine: null,
    ctor: function () {
        this._super();
        this._audioEngine = cc.audioEngine;

        var backgroundLayer = new cc.LayerColor(cc.color(0xCA, 0xF1, 0xF2, 255));
        this.addChild(backgroundLayer);

        this.buttonLayer = new ButtonLayer();
        this.buttonLayer.setDelegate(this);
        this.addChild(this.buttonLayer);

        this.logoLayer = new LogoLayer();
        this.logoLayer.setDelegate(this);
        this.addChild(this.logoLayer);

        this.hiscoreLayer = new HiscoreLayer();
        this.hiscoreLayer.setDelegate(this);
        this.addChild(this.hiscoreLayer);

        this._audioEngine.playMusic(res.title_bgm, true);
    },

    onTapNewGameButton: function (sender, button) {
        this._audioEngine.playEffect(res.newGame_se, false);
        this.changeToGameScene(true);
    },

    onTapLoadGameButton: function (sender, button) {
        this._audioEngine.playEffect(res.newGame_se, false);
        this.changeToGameScene(false);
    },

    changeToGameScene: function (isNewGame) {
        var nextScene = new GameScene();
        nextScene.setParameter({
            isNewGame: isNewGame,
        });
        this._audioEngine.stopMusic();
        cc.director.runScene(nextScene);
    }
});

var ButtonLayer = FunctionLayer.extend({
    ctor: function () {
        this._super();

        var buttonSpriteOn = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff = new cc.Sprite(res.btn_off_png);
        var buttonSpriteOn2 = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff2 = new cc.Sprite(res.btn_off_png);
        var buttonSpriteOn3 = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff3 = new cc.Sprite(res.btn_off_png);
        var buttonSpriteDisabled = new cc.Sprite(res.btn_off_png);

        var buttonWidth = buttonSpriteOn.getContentSize().width;
        var buttonHeight = buttonSpriteOn.getContentSize().height;

        var newGameLabel = new cc.LabelTTF("NEW GAME", FONT, 24);
        newGameLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        newGameLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var loadGameLabel = new cc.LabelTTF("LOAD GAME", FONT, 24);
        loadGameLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        loadGameLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var hiscoreLabel = new cc.LabelTTF("HISCORE", FONT, 24);
        hiscoreLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        hiscoreLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);


        var newGameButton = new cc.MenuItemSprite(buttonSpriteOn, buttonSpriteOff, null, this.callback, this);
        newGameButton.tag= 1;
        newGameButton.addChild(newGameLabel);

        var loadGameButton = new cc.MenuItemSprite(buttonSpriteOn2, buttonSpriteOff2, null, this.callback, this);
        loadGameButton.tag = 2;
        loadGameButton.addChild(loadGameLabel);

        var hiscoreButton = new cc.MenuItemSprite(buttonSpriteOn3, buttonSpriteOff3, buttonSpriteDisabled, this.callback, this);
        hiscoreButton.tag = 3;
        hiscoreButton.addChild(hiscoreLabel);
        hiscoreButton.setEnabled(false);

        var menu = new cc.Menu(newGameButton, loadGameButton, hiscoreButton);
        menu.alignItemsVertically();
        menu.setPosition(cc.winSize.width / 2, cc.winSize.height / 2);
        this.addChild(menu);
    },

    callback: function (button) {
        var tag = button.tag;
        switch (tag) {
            case 1:
                this.onTapNewGameButton(button);
                break;

            case 2:
                this.onTapLoadGameButton(button);
                break;

            case 3:
                this.onTapHiscoreButton(button);
                break;

            default:
                break;
        }
    },

    onTapNewGameButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapNewGameButton)) {
            this._delegate.onTapNewGameButton(this,button);
        }
    },

    onTapLoadGameButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapLoadGameButton)) {
            this._delegate.onTapLoadGameButton(this,button);
        }
    },

    onTapHiscoreButton: function (button) {
        // TODO: button 3 - Show hiscore screen
    },
});

var LogoLayer = FunctionLayer.extend({
    ctor: function () {
        this._super();
        var logo = new cc.LabelTTF("COSTA'S\n2048", FONT, 74);
        logo.color = cc.color(0xAE, 0xCC, 0xC8, 255);
        logo.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        logo.setPosition(cc.winSize.width/2, cc.winSize.height - 200);
        this.addChild(logo);
    }
});

var HiscoreLayer = FunctionLayer.extend({
    // TODO: create hiscore graphic
});