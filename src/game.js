var BOARD_WIDTH = 4;
var BOARD_HEIGHT = 4;
var KEY_DIRECTION = {
    UP:         0,
    DOWN:       1,
    LEFT:       2,
    RIGHT:      3,
};

var PHASE = {
    DEFAULT:    0,
    INIT:       1,
    START:      2,
    IDLE:       3,
    UPDATEDATA: 4,
    MOVE:       5,
    COMBINE:    6,
    CREATE:     7,
    RESULT:     8,
    MENU:       9,
};

var FONT = "Arial Black";

var Tile = function(value, isCombined, canMove, wantsToMove, moved) {
    this.value = value;
    this.isCombined = isCombined;
    this.canMove = canMove;
    this.wantsToMove = wantsToMove;
    this.moved = moved;
    this.viewId = -1;
};

var GameScene = cc.Scene.extend({
    _isNewGame : true,
    onEnter: function () {
        this._super();
        var gameRootLayer = new GameRootLayer(this._isNewGame);
        this.addChild(gameRootLayer);
    },

    setParameter: function (param) {
        this._isNewGame = param.isNewGame;
    }
});

var GameRootLayer = cc.Layer.extend({
    gameLayer: null,
    menuLayer: null,
    soundLayer: null,
    resultLayer: null,
    _score: 0,
    _diff: 0,
    _loadScore: 0,
    _hiScore: 0,
    _updateHiscore: false,
    _boardData: null,
    _isNewGame : false,
    _isChangePhase: false,
    _direction: -1,
    _phase: PHASE.DEFAULT,
    _phaseOrder: PHASE.DEFAULT,
    _tasks: null,
    _audioEngine: null,
    _gameMenuIsOpen: false,
    _resultMenuisOpen: false,
    ctor: function (isNewGame) {
        this._super();
        this._tasks = {};
        this._isNewGame = isNewGame;
        this._audioEngine = cc.audioEngine;

        this.changePhaseOrder(PHASE.INIT);
    },

    onEnter: function () {
        this._super();

        this._audioEngine.playMusic(res.game_bgm, true);
        this.scheduleUpdate();
    },

    onExit: function () {
        this.unscheduleUpdate();
        this._super();
    },

    changePhaseOrder: function ($order) {
        if (this._phase == $order) return;
        if (this._phase == PHASE.MOVE && $order != PHASE.COMBINE) return;
        if (this._phase == PHASE.COMBINE && ($order != PHASE.CREATE && $order != PHASE.RESULT)) return;
        if (this._phase == PHASE.MENU && $order != PHASE.IDLE) return;

        this._phaseOrder = $order;
        this._isChangePhase = true;
    },


    update: function (dt) {
        this._super(dt);

        if (!this._isChangePhase) return;
        this._changePhase();
    },

    _changePhase: function () {
        this._isChangePhase = false;
        if (this._phaseOrder == PHASE.DEFAULT) return;

        this._phase = this._phaseOrder;
        this._phaseOrder = PHASE.DEFAULT;

        switch (this._phase) {
            case PHASE.INIT:
                this.initData();
                break;

            case PHASE.START:
                this.start();
                break;

            case PHASE.UPDATEDATA:
                this.updateActionData(this._direction, true);
                break;

            case PHASE.MOVE:
                this.moveBlocks();
                break;

            case PHASE.COMBINE:
                this.combineBlocks();
                break;

            case PHASE.CREATE:
                this.createNewCells();
                break;

            case PHASE.RESULT:
                this.displayResult();
                break;

            case PHASE.IDLE:
                cc.log("score: "+this._score+", hiscore: "+this._hiScore);
                // console.log(""+this._boardData[0].value+" "+this._boardData[1].value+" "+this._boardData[2].value+" "+this._boardData[3].value);
                // console.log(""+this._boardData[4].value+" "+this._boardData[5].value+" "+this._boardData[6].value+" "+this._boardData[7].value);
                // console.log(""+this._boardData[8].value+" "+this._boardData[9].value+" "+this._boardData[10].value+" "+this._boardData[11].value);
                // console.log(""+this._boardData[12].value+" "+this._boardData[13].value+" "+this._boardData[14].value+" "+this._boardData[15].value+"\n");
                break;

            case PHASE.MENU:
                this.openGameMenu();
                break;

            default:
                break;
        }
    },

    initData: function () {
        this.createLayers();
        this._boardData = this.createBoard();
        this.initHiscore();
        this.gameLayer.setBoard(this._boardData);
        this.setKeyboardListener();
        this.setSwipeListener();
        this.changePhaseOrder(PHASE.START);
    },

    start: function () {
        if (this._isNewGame) {
            for (var i = 0; i < 2; i++) {
                this.createRandomBlock();
                this._score = 0;
            }
        }
        else {
            this.loadBoard();
        }
        this.gameLayer.setScores(this._score, this._hiScore);
        this.gameLayer.updateView();
        this.changePhaseOrder(PHASE.IDLE);
    },

    receiveInformation: function (sender, id, index) {
        this._boardData[index].viewId = id;
    },

    movingEnded: function (sender) {
        this.changePhaseOrder(PHASE.COMBINE);
    },

    combiningEnded: function (sender) {
        this.changePhaseOrder(PHASE.CREATE);
    },

    creatingEnded: function (sender) {
        var isGameOver = this.checkGameOver();
        if (isGameOver) {
            this.changePhaseOrder(PHASE.RESULT);
        } else {
            this.changePhaseOrder(PHASE.IDLE);
        }
    },

    createNewCells: function () {
        var index = this.createRandomBlock();
        this.gameLayer.createActiveCell(index);
    },

    createLayers: function() {
        var backgroundLayer = new cc.LayerColor(cc.color(0xCA, 0xF1, 0xF2, 255));
        this.addChild(backgroundLayer);

        this.gameLayer = new GameLayer();
        this.gameLayer.setDelegate(this);
        this.addChild(this.gameLayer,0);

        this.menuLayer = new MenuLayer();
        this.menuLayer.setDelegate(this);
        this.menuLayer.setVisible(false);
        this.addChild(this.menuLayer,1);

        var musicVol = this._audioEngine.getMusicVolume();
        var soundVol = this._audioEngine.getEffectsVolume();
        this.soundLayer = new SoundLayer(musicVol, soundVol);
        this.soundLayer.setDelegate(this);
        this.soundLayer.setVisible(false);
        this.addChild(this.soundLayer,2);

        this.resultLayer = new ResultLayer();
        this.resultLayer.setDelegate(this);
        this.resultLayer.setVisible(false);
        this.addChild(this.resultLayer,1);
    },

    createBoard: function () {
        var boardData = [];
        for (var i = 0; i < BOARD_HEIGHT * BOARD_WIDTH; i++) {
            boardData[i] = new Tile(0, false, true, false, false); //var Tile = function(value, isCombined, canMove, wantsToMove, moved) viewId default is -1
        }
        return boardData;
    },

    loadBoard: function () {
        if (cc.sys.localStorage.getItem("load") == null) {
            this._isNewGame = true;
            this.start();
        } else {
            var loadData = cc.sys.localStorage.getItem("load");
            var boardData = JSON.parse(loadData);
            for (var i = 0; i < boardData.length; i++) {
                this._boardData[i].value = boardData[i].value;
            }
            var loadScore = parseInt(cc.sys.localStorage.getItem("score"));
            this._score = loadScore;
        }
    },

    createRandomBlock: function () {
        var list = [];
        for (var i = 0; i < this._boardData.length; i++) {
            if (this._boardData[i].value == 0) {
                list.push(i);
            }
        }
        if (list.length == 0) {
            return -1;
        }
        var index = Math.floor(Math.random() * list.length);
        var random = Math.random();
        this._boardData[list[index]].value = (random <= 0.1) ? 2: 1;
        return list[index];
    },

    initHiscore: function () {
        if (cc.sys.localStorage.getItem("hiscore") == null) cc.sys.localStorage.setItem("hiscore", 0);
        this._hiScore = parseInt(cc.sys.localStorage.getItem("hiscore"));
    },

    setSwipeListener: function () {
        this.touchThreshold = 100;
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ALL_AT_ONCE,
            onTouchesBegan: function (touches, event) {
                var touch = touches[0];
                var loc = touch.getLocation();

                this.touchStartPoint = {
                    x: loc.x,
                    y: loc.y
                };

                this.touchLastPoint = {
                    x: loc.x,
                    y: loc.y
                };
            }.bind(this),

            onTouchesMoved: function (touches, event) {
                var touch = touches[0];
                var loc = touch.getLocation(),
                    start = this.touchStartPoint;

                // check for left
                if (loc.x < start.x - this.touchThreshold) {
                    // if direction changed while swiping left, set new base point
                    if (loc.x > this.touchLastPoint.x) {
                        start = this.touchStartPoint = {
                            x: loc.x,
                            y: loc.y
                        };
                        this.isSwipeLeft = false;
                    } else {
                        this.isSwipeLeft = true;
                    }
                }

                // check for right
                if (loc.x > start.x + this.touchThreshold) {
                    // if direction changed while swiping right, set new base point
                    if (loc.x < this.touchLastPoint.x) {
                        this.touchStartPoint = {
                            x: loc.x,
                            y: loc.y
                        };
                        this.isSwipeRight = false;
                    } else {
                        this.isSwipeRight = true;
                    }
                }

                // check for down
                if (loc.y < start.y - this.touchThreshold) {
                    // if direction changed while swiping down, set new base point
                    if (loc.y > this.touchLastPoint.y) {
                        this.touchStartPoint = {
                            x: loc.x,
                            y: loc.y
                        };
                        this.isSwipeDown = false;
                    } else {
                        this.isSwipeDown = true;
                    }
                }

                // check for up
                if (loc.y > start.y + this.touchThreshold) {
                    // if direction changed while swiping right, set new base point
                    if (loc.y < this.touchLastPoint.y) {
                        this.touchStartPoint = {
                            x: loc.x,
                            y: loc.y
                        };
                        this.isSwipeUp = false;
                    } else {
                        this.isSwipeUp = true;
                    }
                }

                this.touchLastPoint = {
                    x: loc.x,
                    y: loc.y
                };
            }.bind(this),

            onTouchesEnded: function (touches, event) {
                console.log("onTouchesEnded!");

                this.touchStartPoint = null;


                if (this.isSwipeUp) {
                    this.onSwipeUp();
                } else if (this.isSwipeLeft) {
                    this.onSwipeLeft();
                } else if (this.isSwipeRight) {
                    this.onSwipeRight();
                } else if (this.isSwipeDown) {
                    this.onSwipeDown();
                }

                this.isSwipeUp = this.isSwipeLeft = this.isSwipeRight = this.isSwipeDown = false;

                //location.y = this.size.height;
                //event.getCurrentTarget().addNewTileWithCoords(location);
            }.bind(this)
        }, this);
    },

    onSwipeUp: function () {
        if (this._phase != PHASE.IDLE) return;
        this._direction = KEY_DIRECTION.UP;
        this.changePhaseOrder(PHASE.UPDATEDATA);
    },

    onSwipeDown: function () {
        if (this._phase != PHASE.IDLE) return;
        this._direction = KEY_DIRECTION.DOWN;
        this.changePhaseOrder(PHASE.UPDATEDATA);
    },

    onSwipeRight: function () {
        if (this._phase != PHASE.IDLE) return;
        this._direction = KEY_DIRECTION.RIGHT;
        this.changePhaseOrder(PHASE.UPDATEDATA);
    },

    onSwipeLeft: function () {
        if (this._phase != PHASE.IDLE) return;
        this._direction = KEY_DIRECTION.LEFT;
        this.changePhaseOrder(PHASE.UPDATEDATA);
    },

    setKeyboardListener: function () {
        cc.eventManager.addListener({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed: function(keyCode, event) {
                if (this._phase != PHASE.IDLE) return;
                switch (keyCode) {
                    case 37:
                        this._direction = KEY_DIRECTION.LEFT;
                        break;

                    case 38:
                        this._direction = KEY_DIRECTION.UP;
                        break;

                    case 39:
                        this._direction = KEY_DIRECTION.RIGHT;
                        break;

                    case 40:
                        this._direction = KEY_DIRECTION.DOWN;
                        break;

                    default:
                        return;
                }
                this.changePhaseOrder(PHASE.UPDATEDATA);
            }.bind(this),

            onKeyReleased: function(keyCode, event) {
            }.bind(this),
        }, this);
    },

    updateActionData: function (direction, isFirstRun) {
        if (direction != KEY_DIRECTION.UP &&
            direction != KEY_DIRECTION.DOWN &&
            direction != KEY_DIRECTION.RIGHT &&
            direction != KEY_DIRECTION.LEFT) {
            return;
        }
        var moveOrder = [];
        var cantMoveIndexes = [];
        for (var y = 0; y < BOARD_HEIGHT; y++) {
            for (var x = 0; x < BOARD_WIDTH; x++) {
                var index = (4 * y) + x;
                var value = this._boardData[index].value;
                if (value != 0) {
                    var oldIndex = index;
                    var newIndex = index;
                    this._boardData[oldIndex].canMove = true;
                    switch (direction) {
                        case KEY_DIRECTION.LEFT: //LEFT
                            if (x == 0) {
                                this._boardData[oldIndex].canMove = false;
                                break;
                            }
                            newIndex = oldIndex - 1;
                            break;

                        case KEY_DIRECTION.UP: // UP
                            if (y == 0) {
                                this._boardData[oldIndex].canMove = false;
                                break;
                            }
                            newIndex = 4 * (y - 1) + x;
                            break;

                        case KEY_DIRECTION.RIGHT: // RIGHT
                            if (x == BOARD_WIDTH - 1) {
                                this._boardData[oldIndex].canMove = false;
                                break;
                            }
                            newIndex = oldIndex + 1;
                            break;

                        case KEY_DIRECTION.DOWN: // DOWN
                            if (y == BOARD_HEIGHT - 1) {
                                this._boardData[oldIndex].canMove = false;
                                break;
                            }
                            newIndex = 4 * (y + 1) + x;
                            break;
                    }
                    if (!this._boardData[oldIndex].canMove || (this._boardData[newIndex].value != 0 && this._boardData[oldIndex].value != this._boardData[newIndex].value)
                        || this._boardData[oldIndex].isCombined || this._boardData[newIndex].isCombined) {
                        cantMoveIndexes.push(oldIndex);
                    }
                    if (this._boardData[oldIndex].isCombined || this._boardData[newIndex].isCombined) {
                        this._boardData[oldIndex].wantsToMove = true;
                    }
                    if (oldIndex != newIndex) {
                        moveOrder.push({from: oldIndex, to: newIndex});
                    }
                }
            }
        }
        console.dir(cantMoveIndexes);
        console.dir(moveOrder);
        var canMove = true;
        var moved = false;
        var tempBoardData = this.createBoard();
        for (var i = 0; i < moveOrder.length; i++) {
            var nextLocation = moveOrder[i].to;
            var currentLocation = moveOrder[i].from;
            if (cantMoveIndexes.length > 0) {
                canMove = (cantMoveIndexes.indexOf(moveOrder[i].from) == -1);
            }
            if (this._boardData[currentLocation].wantsToMove) {
                if (this._boardData[nextLocation].moved && !this._boardData[nextLocation].isCombined) {
                    canMove = true;
                }
            }
            if (canMove) {
                tempBoardData[nextLocation].value = this._boardData[currentLocation].value;
                tempBoardData[nextLocation].viewId = this._boardData[currentLocation].viewId;
                moved = true;
                var toMoveCellId = this._boardData[currentLocation].viewId;
                if (!this._tasks[toMoveCellId]) this._tasks[toMoveCellId] = { move:[], combine: {value: 0, willCombine: false, removeId: -1, combineId: -1}};
                this._tasks[toMoveCellId].move.push(nextLocation);
                this._boardData[currentLocation].value = 0;
                this._boardData[currentLocation].moved = true;
                this._boardData[currentLocation].viewId = -1;
            }
        }
        for (var i = 0; i < tempBoardData.length; i++) {
            if (tempBoardData[i].value != this._boardData[i].value && tempBoardData[i].value != 0) {
                this._boardData[i].value = tempBoardData[i].value;
                this._boardData[i].viewId = tempBoardData[i].viewId;
            }
            else if (tempBoardData[i].value == this._boardData[i].value && tempBoardData[i].value != 0) {
                this._boardData[i].value++;
                this._boardData[i].isCombined = true;
                var toRemoveId = tempBoardData[i].viewId;
                var toCombineId = this._boardData[i].viewId;
                this.updateScore(this._boardData[i].value);
                if (!this._tasks[toCombineId]) this._tasks[toCombineId] = { move: [], combine: {value: 0, willCombine: false, removeId: -1, combineId: -1}};
                this._tasks[toCombineId].combine.willCombine = true;
                this._tasks[toCombineId].combine.value = this._boardData[i].value;
                this._tasks[toCombineId].combine.removeId = toRemoveId;
                this._tasks[toCombineId].combine.combineId = toCombineId;
            }
        }
        if (moved) {
            this.updateActionData(direction, false);
        } else {
            for (var i = 0; i < this._boardData.length; i++) {
                this._boardData[i].isCombined = false;
                this._boardData[i].wantsToMove = false;
                this._boardData[i].moved = false
            }
            if (!isFirstRun && !moved) {
                this.changePhaseOrder(PHASE.MOVE);
            } else {
                this.changePhaseOrder(PHASE.IDLE);
            }
        }
    },

    checkGameOver: function () {
        return (!this._checkCanMove(KEY_DIRECTION.DOWN)
            &&  !this._checkCanMove(KEY_DIRECTION.RIGHT)
            &&  !this._checkCanMove(KEY_DIRECTION.LEFT)
            &&  !this._checkCanMove(KEY_DIRECTION.UP));
    },

    _checkCanMove: function (direction) {
        var cantMoveIndexes = [];
        for (var y = 0; y < BOARD_HEIGHT; y++) {
            for (var x = 0; x < BOARD_WIDTH; x++) {
                var index = (4 * y) + x;
                var value = this._boardData[index].value;
                if (value != 0) {
                    var oldIndex = index;
                    var newIndex = index;
                    var canMove = true;
                    switch (direction) {
                        case KEY_DIRECTION.LEFT: //LEFT
                            if (x == 0) {
                                canMove = false;
                                break;
                            }
                            newIndex = oldIndex - 1;
                            break;

                        case KEY_DIRECTION.UP: // UP
                            if (y == 0) {
                                canMove = false;
                                break;
                            }
                            newIndex = 4 * (y - 1) + x;
                            break;

                        case KEY_DIRECTION.RIGHT: // RIGHT
                            if (x == BOARD_WIDTH - 1) {
                                canMove = false;
                                break;
                            }
                            newIndex = oldIndex + 1;
                            break;

                        case KEY_DIRECTION.DOWN: // DOWN
                            if (y == BOARD_HEIGHT - 1) {
                                canMove = false;
                                break;
                            }
                            newIndex = 4 * (y + 1) + x;
                            break;
                    }
                    if (!canMove || (this._boardData[newIndex].value != 0 && this._boardData[oldIndex].value != this._boardData[newIndex].value)){
                        cantMoveIndexes.push(oldIndex);
                    }
                }
            }
        }
        return !(cantMoveIndexes.length == 16);
    },

    moveBlocks: function () {
        this.gameLayer.moveActiveCell(this._tasks);
    },

    combineBlocks: function () {
        this.gameLayer.combineActiveCells(this._tasks, this._diff, this._score, this._hiScore, this._updateHiscore);
    },

    updateScore: function(score) {
        this._diff = Math.pow(2,score);;
        this._score += this._diff;
        this.gameLayer.setScores(this._score);
        if (this._score > this._hiScore){
            this._hiScore = this._score;
            cc.sys.localStorage.setItem("hiscore", this._hiScore);
            this._updateHiscore = true;
        }
    },

    displayResult: function () {
        this.openResultMenu();
        cc.audioEngine.stopMusic();
        cc.audioEngine.playEffect(res.gameOver_jingle, false);
        cc.audioEngine.playMusic(res.gameOver_bgm, true);
    },

    onTapMenuButton: function (sender, button) {
        if (this._phase != PHASE.IDLE) return;
        this._audioEngine.playEffect(res.menuOpened_se, false);
        this.changePhaseOrder(PHASE.MENU);
    },

    onTapBackgroundButton: function (sender) {
        this.closeGameMenu();
    },

    onTapNewGameButton: function (sender) {
        this._audioEngine.playEffect(res.newGame_se, false);
        this.gameLayer.clearActiveCells();
        this.clearBoard();
        this.closeGameMenu();
        this.closeResultMenu();
        this.gameLayer.setBoard(this._boardData);
        this._isNewGame = true;
        this.start();
        this._audioEngine.stopMusic();
        this._audioEngine.playMusic(res.game_bgm, true);
    },

    onTapSaveButton: function (sender) {
        this._audioEngine.playEffect(res.buttonTap_se, false);
        var loadData = JSON.stringify(this._boardData);
        cc.sys.localStorage.setItem("load", loadData);
        cc.sys.localStorage.setItem("score", this._score);
        this.menuLayer.createSaveLabel();
    },

    onTapSoundButton: function (sender) {
        this.openSoundMenu();
    },

    onTapCloseSoundMenu: function (sender) {
        this.closeSoundMenu();
    },

    onTapExitButton: function (sender) {
        this._audioEngine.playEffect(res.buttonTap_se, false);
        var nextScene = new TitleScene();
        cc.audioEngine.stopMusic();
        cc.director.runScene(nextScene);
    },

    openGameMenu: function () {
        if (this._gameMenuIsOpen) return;
        this._gameMenuIsOpen = true;
        this.menuLayer.setVisible(true);
        this.gameLayer.toggleGameLabel(false);
        this.gameLayer.gameLayerPause();
    },

    openSoundMenu: function () {
        this.soundLayer.setVisible(true);
        this.menuLayer.toggleMenuLabel(false);
        this.menuLayer.togglePause(false);
    },

    openResultMenu: function () {
        if (this._resultMenuIsOpen) return;
        this._resultMenuIsOpen = true;
        this.resultLayer.setVisible(true);
    },

    closeGameMenu: function () {
        if (!this._gameMenuIsOpen) return;
        this.menuLayer.setVisible(false);
        this.gameLayer.toggleGameLabel(true);
        this.gameLayer.gameLayerResume();
        this.changePhaseOrder(PHASE.IDLE);
        this._gameMenuIsOpen = false;
    },

    closeSoundMenu: function () {
        this.soundLayer.setVisible(false);
        this.menuLayer.toggleMenuLabel(true);
        this.menuLayer.togglePause(true);
    },

    closeResultMenu: function () {
        if (!this._resultMenuIsOpen) return;
        this.resultLayer.setVisible(false);
        this._resultMenuIsOpen = false;
    },

    clearBoard: function () {
        for (var i = 0; i < this._boardData.length; i++) {
            this._boardData[i].value = 0;
        }
    },

    BGMVolChange: function ($musicVol) {
        this._audioEngine.setMusicVolume($musicVol);
        cc.sys.localStorage.setItem("music", $musicVol);
    },

    SEVolChange: function ($soundVol) {
        this._audioEngine.setEffectsVolume($soundVol);
        cc.sys.localStorage.setItem("sound", $soundVol);
    }
});


var GameLayer = FunctionLayer.extend({
    _boardData : null, // Data
    _tilePos : null,
    _backBoard : null, // Graphic
    _tileSize : 0,
    _idCount: 0,
    _score: 0,
    _hiScore: 0,
    _scoreLabel: null,
    _hiscoreLabel: null,
    _gameLabel: null,
    _menu: null,
    ctor: function () {
        this._super();
        this.drawBaseBoard();
        this.drawTextLabels();
        this.drawMenuButton();
        this.drawGameLabel();
    },

    updateView: function () {
        for (var i = 0; i < BOARD_WIDTH * BOARD_HEIGHT; i++) {
            if (this.getActiveCell(this._boardData[i].viewId) != null) continue;
            if (this._boardData[i].value != 0) {
                this.createActiveCell(i);
            }
        }
        this.initializeScores();
    },

    initializeScores: function () {
        this._scoreLabel.setString(""+ this._punctuationNumber(this._score));
        this._hiscoreLabel.setString(""+ this._punctuationNumber(this._hiScore));
    },

    setBoard: function (board) {
        this._boardData = board;
    },

    setScores: function (score, hiscore) {
        this._score = score;
        this._hiScore = hiscore;
    },

    drawTextLabels: function () {
        var scoreTextLabel = new cc.LabelTTF("Score", FONT, 36);
        scoreTextLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        scoreTextLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        scoreTextLabel.setPosition(175, cc.winSize.height - 150);
        this.addChild(scoreTextLabel, 0);

        var scoreLabel = this._scoreLabel = new cc.LabelTTF(""+this._punctuationNumber(this._score), FONT, 30);
        scoreLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        scoreLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        scoreLabel.setPosition(175, cc.winSize.height - 185);
        this.addChild(scoreLabel, 0);

        var hiscoreTextLabel = new cc.LabelTTF("Best", FONT, 36);
        hiscoreTextLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        hiscoreTextLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        hiscoreTextLabel.setPosition(cc.winSize.width - 175, cc.winSize.height - 150);
        this.addChild(hiscoreTextLabel, 0);

        var hiscoreLabel = this._hiscoreLabel = new cc.LabelTTF(""+this._punctuationNumber(this._hiScore), FONT, 30);
        hiscoreLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        hiscoreLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        hiscoreLabel.setPosition(cc.winSize.width - 175, cc.winSize.height - 185);
        this.addChild(hiscoreLabel, 0);
    },

    drawBaseBoard: function () {
        var screen_x = cc.winSize.width;
        var backBoard_x = screen_x - 180;
        this._backBoard = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        this._backBoard.setContentSize(backBoard_x, backBoard_x);
        this._backBoard.setPosition(screen_x / 2, screen_x / 2);
        this._backBoard.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        this.createTiles(this._backBoard, backBoard_x);

        this.addChild(this._backBoard,0);
    },

    drawMenuButton: function () {
        var buttonSpriteOn = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff = new cc.Sprite(res.btn_off_png);

        var buttonWidth = buttonSpriteOn.getContentSize().width;
        var buttonHeight = buttonSpriteOn.getContentSize().height;

        var menuLabel = new cc.LabelTTF("MENU", FONT, 24);
        menuLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        menuLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var menuButton = new cc.MenuItemSprite(buttonSpriteOn, buttonSpriteOff, null, this.onTapMenuButton, this);
        menuButton.tag= 1;
        menuButton.addChild(menuLabel);

        var menu = this._menu = new cc.Menu(menuButton);
        menu.alignItemsVertically();
        menu.setPosition(cc.winSize.width / 2, cc.winSize.height - 300);
        this.addChild(menu);

    },

    onTapMenuButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapMenuButton)) {
            this._delegate.onTapMenuButton(this,button);
        }
    },

    drawGameLabel: function () {
        var gameLabel = this._gameLabel = new cc.LabelTTF("2048", FONT, 46);
        gameLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        gameLabel.setPosition(cc.winSize.width / 2, cc.winSize.height - 90);
        this.addChild(gameLabel, 0);
    },

    toggleGameLabel: function ($visible) {
        this._gameLabel.setVisible($visible);
    },

    createTiles: function(backBoard, backBoard_x) {
        this._tilePos = [];
        var paddingSize = 12;
        this._tileSize = ((backBoard_x - paddingSize * 5)/4);

        for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
            for (var x = 0; x < BOARD_WIDTH; x++) {
                var tile = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
                tile.setContentSize(this._tileSize, this._tileSize);
                var tile_x = (paddingSize + this._tileSize / 2) + x * (paddingSize + this._tileSize);
                var tile_y = (paddingSize + this._tileSize / 2) + y * (paddingSize + this._tileSize);
                this._tilePos.push(cc.p(tile_x,tile_y));
                tile.setPosition(tile_x, tile_y);
                tile.setColor(cc.color(0xCC, 0xE7, 0xE4, 255));
                backBoard.addChild(tile, 0);
            }
        }
    },

    createActiveCell: function (index) {
        var activeCell = new ActiveCell(this._boardData[index].value, this._tileSize, this._idCount);
        this._idCount++;
        activeCell.setPosition(this._tilePos[index]);
        activeCell.setScale(0);
        activeCell.setName("activeCell");
        this._backBoard.addChild(activeCell, 1);
        if (this._delegate && cc.isFunction(this._delegate.receiveInformation)) {
            this._delegate.receiveInformation(this, activeCell.getID(), index);
        }
        activeCell.runAction(cc.sequence(cc.scaleTo(0.05,1,1), cc.callFunc(this.endCreateAction, this)));
    },

    endCreateAction: function () {
        if (this._delegate && cc.isFunction(this._delegate.creatingEnded)) {
            this._delegate.creatingEnded(this);
        }
    },

    clearActiveCells: function () {
        while (true) {
            var activeCell = this._backBoard.getChildByName("activeCell");
            if (activeCell == null) {
                break;
            }
            activeCell.removeFromParent(true);
        }
    },
    getActiveCell: function (id) {
        if (id == -1) return null;
        var activeCells = this._backBoard.getChildren();
        for (var i = 0; i < activeCells.length; i++) {
            if (activeCells[i] instanceof ActiveCell) {
                if (activeCells[i].getID() == id) {
                    return activeCells[i];
                }
            }
        }
        return null;
    },

    moveActiveCell: function (tasks) {
        var actions = [];
        for (var id in tasks) {
            if (!tasks.hasOwnProperty(id)) continue;
            var task = tasks[id];
            if (task.move.length == 0) continue;
            var cellToMove = this.getActiveCell(id);
            if (cellToMove == null) continue;
            var newPos = this._tilePos[task.move[task.move.length-1]];
            actions.push(cc.targetedAction(cellToMove, cc.moveTo(0.1, newPos)));
        }
        if (actions.length == 0) {
            this.endMoveAction();
        } else {
            this.runAction(cc.sequence(cc.spawn(actions),cc.delayTime(0.01), cc.callFunc(this.endMoveAction, this)));
            cc.audioEngine.playEffect(res.flick_se, false);
        }
    },

    endMoveAction: function () {
        if (this._delegate && cc.isFunction(this._delegate.movingEnded)) {
            this._delegate.movingEnded(this);
        }
    },

    combineActiveCells: function (tasks, diff, score, hiscore, updateHiscore) {
        var actions = [];
        for (var id in tasks) {
            if (!tasks.hasOwnProperty(id)) continue;
            var task = tasks[id];
            if (task.combine.willCombine == false) continue;
            var cellToCombine = this.getActiveCell(task.combine.combineId);
            var cellToRemove = this.getActiveCell(task.combine.removeId);
            if (cellToCombine == null || cellToRemove == null) continue;
            cellToCombine.setUserData(task.combine.value);
            actions.push(cc.targetedAction(cellToCombine, cc.sequence(
                cc.scaleTo(0.025, 1.1, 1.1),
                cc.callFunc(function (){
                    var value = this.getUserData();
                    this.setValue(value);
                    this.setUserData(null);

                }, cellToCombine),
                cc.scaleTo(0.025, 1, 1)
            )));
            actions.push(cc.targetedAction(cellToRemove, cc.removeSelf(true)));
        }
        if (actions.length == 0) {
            this.endCombineAction();
        } else {
            this.runAction(cc.sequence(cc.spawn(actions),cc.delayTime(0.01), cc.callFunc(function () {
                this.endCombineAction(diff, score, hiscore, updateHiscore);
            }, this)));
        }
    },

    endCombineAction: function (diff, score, hiscore, updateHiscore) {
        if (cc.isNumber(diff) && diff > 0) {
            cc.assert(!cc.isUndefined(score), "score is undefined!");
            this._scoreLabel.setString(this._punctuationNumber(score));
            var diffLabel = new cc.LabelTTF("+"+diff, FONT, 30);
            diffLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
            diffLabel.setPosition(cc.pAdd(this._scoreLabel.getPosition(),cc.p(0,15)));
            this.addChild(diffLabel, 1);
            diffLabel.runAction(cc.sequence(
                cc.spawn(
                    cc.moveBy(1, 0, 70),
                    cc.fadeTo(1, 0)
                ), cc.removeSelf(true)));
        }
        if (!cc.isUndefined(updateHiscore)) {
            if (updateHiscore) {
                cc.assert(!cc.isUndefined(hiscore), "hiscore is undefined!");
                this._hiscoreLabel.setString(this._punctuationNumber(hiscore));
            }
        }
        if (this._delegate && cc.isFunction(this._delegate.combiningEnded)) {
            this._delegate.combiningEnded(this);
        }
    },

    _punctuationNumber : function ($value) {
        var value = Number($value);
        var isMinus = (value<0);
        value = Math.abs(value);
        var integral = parseInt(value);
        var decimal = value - integral;
        var result = "";
        var str = integral.toString();

        for (var i = 0, len = str.length; i < len; i=(i+1)|0) {
            result += str[i];
            if ((len-i-1)%3 == 0 && (len-i-1) > 0) result += ",";
        }

        if (decimal != 0) result += ("." + decimal);
        if (isMinus) result = "-"+result;
        return result;
    },

    gameLayerPause: function () {
        this._menu.setEnabled(false);
    },

    gameLayerResume: function () {
        this._menu.setEnabled(true);
    }
});

var MenuLayer = FunctionLayer.extend({
    _menu: null,
    _menuLabel: null,
    ctor: function () {
        this._super();
        this.createButtons();
        this.createMenuLabel();
    },

    createButtons: function () {
        var buttonSpriteOn = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff = new cc.Sprite(res.btn_off_png);
        var buttonSpriteOn2 = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff2 = new cc.Sprite(res.btn_off_png);
        var buttonSpriteOn3 = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff3 = new cc.Sprite(res.btn_off_png);
        var buttonSpriteOn4 = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff4 = new cc.Sprite(res.btn_off_png);

        var buttonWidth = buttonSpriteOn.getContentSize().width;
        var buttonHeight = buttonSpriteOn.getContentSize().height;

        var newGameLabel = new cc.LabelTTF("NEW GAME", FONT, 24);
        newGameLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        newGameLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var saveGameLabel = new cc.LabelTTF("SAVE GAME", FONT, 24);
        saveGameLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        saveGameLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var soundLabel = new cc.LabelTTF("SOUND", FONT, 24);
        soundLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        soundLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var exitLabel = new cc.LabelTTF("EXIT", FONT, 24);
        exitLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        exitLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);


        var newGameButton = new cc.MenuItemSprite(buttonSpriteOn, buttonSpriteOff, null, this.callback, this);
        newGameButton.tag= 1;
        newGameButton.setPosition(0, 220)
        newGameButton.addChild(newGameLabel);
        newGameButton.setLocalZOrder(2);

        var saveGameButton = new cc.MenuItemSprite(buttonSpriteOn2, buttonSpriteOff2, null, this.callback, this);
        saveGameButton.tag = 2;
        saveGameButton.setPosition(0, 110)
        saveGameButton.addChild(saveGameLabel);
        saveGameButton.setLocalZOrder(2);

        var soundButton = new cc.MenuItemSprite(buttonSpriteOn3, buttonSpriteOff3, null, this.callback, this);
        soundButton.tag = 3;
        soundButton.setPosition(0, 0)
        soundButton.addChild(soundLabel);
        soundButton.setLocalZOrder(2);

        var exitButton = new cc.MenuItemSprite(buttonSpriteOn4, buttonSpriteOff4, null, this.callback, this);
        exitButton.tag = 4;
        exitButton.setPosition(0, -110)
        exitButton.addChild(exitLabel);
        exitButton.setLocalZOrder(2);

        var backgroundOn = new cc.Sprite(res.white_box_png);
        backgroundOn.setColor(cc.color(0, 0, 0, 255));
        backgroundOn.setScale((cc.winSize.width+10) / 2, (cc.winSize.height+10) / 2);
        backgroundOn.setOpacity(128);
        backgroundOn.setContentSize(cc.winSize.width + 10, cc.winSize.height + 10);

        var backgroundOff = new cc.Sprite(res.white_box_png);
        backgroundOff.setColor(cc.color(0, 0, 0, 255));
        backgroundOff.setScale((cc.winSize.width+10) / 2, (cc.winSize.height+10) / 2);
        backgroundOff.setOpacity(128);
        backgroundOff.setContentSize(cc.winSize.width + 10, cc.winSize.height + 10);


        var backgroundButton = new cc.MenuItemSprite(backgroundOn, backgroundOff, null, this.callback, this);
        backgroundButton.tag = 5;
        backgroundButton.setLocalZOrder(0);

        var backPanelOn = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        backPanelOn.setContentSize(370, 490);
        backPanelOn.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        var backPanelOff = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        backPanelOff.setContentSize(370, 490);
        backPanelOff.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        var backPanel = new cc.MenuItemSprite(backPanelOn, backPanelOff, null, this.callback, this);
        backPanel.tag = 6;
        backPanel.setPosition(0, 55);
        backPanel.setLocalZOrder(1);


        var menu = this._menu = new cc.Menu();
        menu.setPosition(cc.winSize.width / 2, cc.winSize.height / 2);
        menu.addChild(newGameButton);
        menu.addChild(saveGameButton);
        menu.addChild(soundButton);
        menu.addChild(exitButton);
        menu.addChild(backgroundButton);
        menu.addChild(backPanel);
        this.addChild(menu,0);
    },

    createMenuLabel: function () {
        var menuLabel = this._menuLabel = new cc.LabelTTF("MENU", FONT, 46);
        menuLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        menuLabel.setPosition(cc.winSize.width / 2, cc.winSize.height - 90);
        this.addChild(menuLabel, 1);
    },

    toggleMenuLabel: function ($visible) {
        this._menuLabel.setVisible($visible);
    },

    createSaveLabel: function () {
        var saveLabel = new cc.LabelTTF("Saved.", FONT, 36);
        saveLabel.setColor(cc.color(255,0,0));
        saveLabel.setPosition(cc.winSize.width / 2, cc.winSize.height / 2 - 230);
        this.addChild(saveLabel, 1);
        saveLabel.runAction(cc.sequence(cc.delayTime(1.5), cc.removeSelf(true)));
    },

    callback: function(button) {
        var tag = button.tag;
        switch (tag) {
            case 1:
                this.onTapNewGameButton();
                break;

            case 2:
                this.onTapSaveGameButton();
                break;

            case 3:
                this.onTapSoundButton();
                break;

            case 4:
                this.onTapExitButton();
                break;

            case 5:
                this.onTapBackgroundButton();
                break;

            case 6:
                break;

            default:
                break;
        }
    },

    onTapNewGameButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapNewGameButton)) {
            this._delegate.onTapNewGameButton(this);
        }
    },


    onTapSaveGameButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapSaveButton)) {
            this._delegate.onTapSaveButton(this);
        }
    },

    onTapSoundButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapSoundButton)) {
            this._delegate.onTapSoundButton(this);
        }
    },

    onTapExitButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapExitButton)) {
            this._delegate.onTapExitButton(this);
        }
    },

    onTapBackgroundButton: function (button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapBackgroundButton)) {
            this._delegate.onTapBackgroundButton(this);
        }
    },

    togglePause: function ($isRunning) {
        this._menu.setEnabled($isRunning);
    }
});

var SoundLayer = FunctionLayer.extend({
    _BGMSlider: null,
    _SESlider: null,
    _soundLabel: null,
    ctor: function ($musicVol, $soundVol) {
        this._super();
        this.createSoundLayer($musicVol, $soundVol);
        this.createSoundLabel();
    },

    createSoundLayer: function ($musicVol, $soundVol) {
        var backPanelOn = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        backPanelOn.setContentSize(470, 260);
        backPanelOn.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        var backPanelOff = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        backPanelOff.setContentSize(470, 260);
        backPanelOff.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        var backgroundOn = new cc.Sprite(res.white_box_png);
        backgroundOn.setColor(cc.color(0, 0, 0, 255));
        backgroundOn.setScale((cc.winSize.width+10) / 2, (cc.winSize.height+10) / 2);
        backgroundOn.setOpacity(128);
        backgroundOn.setContentSize(cc.winSize.width + 10, cc.winSize.height + 10);

        var backgroundOff = new cc.Sprite(res.white_box_png);
        backgroundOff.setColor(cc.color(0, 0, 0, 255));
        backgroundOff.setScale((cc.winSize.width+10) / 2, (cc.winSize.height+10) / 2);
        backgroundOff.setOpacity(128);
        backgroundOff.setContentSize(cc.winSize.width + 10, cc.winSize.height + 10);

        var backPanel = new cc.MenuItemSprite(backPanelOn, backPanelOff, null, this.callback, this);
        backPanel.tag = 1;
        backPanel.setPosition(0, 55);
        backPanel.setLocalZOrder(1);

        var backgroundButton = new cc.MenuItemSprite(backgroundOn, backgroundOff, null, this.callback, this);
        backgroundButton.tag = 2;
        backgroundButton.setLocalZOrder(0);

        this.createSoundSliders($musicVol, $soundVol);
        backPanel.addChild(this._BGMSlider);
        backPanel.addChild(this._SESlider);

        var BGMLabel = new cc.LabelTTF("MUSIC", FONT, 30);
        BGMLabel.setPosition(235, 220);
        BGMLabel.setColor(cc.color(0x7E, 0x9C, 0x98, 255));

        var SELabel = new cc.LabelTTF("SOUND", FONT, 30);
        SELabel.setPosition(235, 110);
        SELabel.setColor(cc.color(0x7E, 0x9C, 0x98, 255));

        backPanel.addChild(BGMLabel,1);
        backPanel.addChild(SELabel,1);

        var menu = this._menu = new cc.Menu();
        menu.setPosition(cc.winSize.width / 2, cc.winSize.height / 2);
        menu.addChild(backgroundButton);
        menu.addChild(backPanel);
        this.addChild(menu,0);
    },

    createSoundSliders: function ($musicVol, $soundVol) {
        this._BGMSlider = new ccui.Slider();
        this._BGMSlider.addEventListener(this.onMoveBGMSlider, this);
        this._BGMSlider.setScale9Enabled(true);
        this._BGMSlider.setCapInsets(cc.rect(0,0,9,9));
        this._BGMSlider.loadSlidBallTextures(res.volume_icon_png);
        this._BGMSlider.loadBarTexture(res.volume_slider_png);
        this._BGMSlider.loadProgressBarTexture(res.volume_gauge_png);
        this._BGMSlider.setPosition(235, 180);
        this._BGMSlider.setContentSize(231, 9);
        this._BGMSlider.setScale(1.5,1.5);
        this._BGMSlider.setPercent($musicVol*100);


        this._SESlider = new ccui.Slider();
        this._SESlider.addEventListener(this.onMoveSESlider, this);
        this._SESlider.setScale9Enabled(true);
        this._SESlider.setCapInsets(cc.rect(0,0,9,9));
        this._SESlider.loadSlidBallTextures(res.volume_icon_png);
        this._SESlider.loadBarTexture(res.volume_slider_png);
        this._SESlider.loadProgressBarTexture(res.volume_gauge_png);
        this._SESlider.setPosition(235, 70);
        this._SESlider.setContentSize(231, 9);
        this._SESlider.setScale(1.5,1.5);
        this._SESlider.setPercent($soundVol*100);
    },

    createSoundLabel: function () {
        var soundLabel = this._soundLabel = new cc.LabelTTF("SOUND", FONT, 46);
        soundLabel.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));
        soundLabel.setPosition(cc.winSize.width / 2, cc.winSize.height - 90);
        this.addChild(soundLabel, 1);
    },

    // toggleSoundLabel: function ($visible) {
    //     this._soundLabel.setVisible($visible);
    // },

    onMoveBGMSlider: function ($obj) {
        if (this._delegate && cc.isFunction(this._delegate.BGMVolChange)) {
            this._delegate.BGMVolChange($obj.getPercent()/100);
        }
    },

    onMoveSESlider: function ($obj) {
        if (this._delegate && cc.isFunction(this._delegate.SEVolChange)) {
            this._delegate.SEVolChange($obj.getPercent()/100);
        }
    },

    callback: function (button) {
        var tag = button.tag;
        switch (tag) {
            case 1:
                break;

            case 2:
                this.onTapCloseSoundMenu();
                break;

            default:
                break;
        }
    },

    onTapCloseSoundMenu: function () {
        if (this._delegate && cc.isFunction(this._delegate.onTapCloseSoundMenu)) {
            this._delegate.onTapCloseSoundMenu(this);
        }
    }
});

var ResultLayer = FunctionLayer.extend({
    ctor: function () {
        this._super();
        this.createResultLayer();
    },

    createResultLayer: function () {
        var backPanelOn = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        backPanelOn.setContentSize(500, 320);
        backPanelOn.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        var backPanelOff = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        backPanelOff.setContentSize(500, 320);
        backPanelOff.setColor(cc.color(0xAE, 0xCC, 0xC8, 255));

        var backgroundOn = new cc.Sprite(res.white_box_png);
        backgroundOn.setColor(cc.color(0, 0, 0, 255));
        backgroundOn.setScale((cc.winSize.width+10) / 2, (cc.winSize.height+10) / 2);
        backgroundOn.setOpacity(128);
        backgroundOn.setContentSize(cc.winSize.width + 10, cc.winSize.height + 10);

        var backgroundOff = new cc.Sprite(res.white_box_png);
        backgroundOff.setColor(cc.color(0, 0, 0, 255));
        backgroundOff.setScale((cc.winSize.width+10) / 2, (cc.winSize.height+10) / 2);
        backgroundOff.setOpacity(128);
        backgroundOff.setContentSize(cc.winSize.width + 10, cc.winSize.height + 10);

        var buttonSpriteOn = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff = new cc.Sprite(res.btn_off_png);
        var buttonSpriteOn2 = new cc.Sprite(res.btn_on_png);
        var buttonSpriteOff2 = new cc.Sprite(res.btn_off_png);

        var buttonWidth = buttonSpriteOn.getContentSize().width;
        var buttonHeight = buttonSpriteOn.getContentSize().height;

        var newGameLabel = new cc.LabelTTF("NEW GAME", FONT, 24);
        newGameLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        newGameLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var titleLabel = new cc.LabelTTF("TITLE", FONT, 24);
        titleLabel.setPosition(buttonWidth / 2, buttonHeight / 2);
        titleLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);

        var gameOverLabel = new cc.LabelTTF("GAME OVER!", FONT, 40);
        gameOverLabel.setPosition(250,270);
        gameOverLabel.setHorizontalAlignment(cc.TEXT_ALIGNMENT_CENTER);
        gameOverLabel.setColor(cc.color(0x7E, 0x9C, 0x98, 255));


        var backPanel = new cc.MenuItemSprite(backPanelOn, backPanelOff, null, this.callback, this);
        backPanel.tag = 1;
        // backPanel.setPosition(0, 0);
        backPanel.setLocalZOrder(1);

        backPanel.addChild(gameOverLabel);

        var backgroundButton = new cc.MenuItemSprite(backgroundOn, backgroundOff, null, this.callback, this);
        backgroundButton.tag = 2;
        backgroundButton.setLocalZOrder(0);

        var newGameButton = new cc.MenuItemSprite(buttonSpriteOn, buttonSpriteOff, null, this.callback, this);
        newGameButton.tag= 3;
        newGameButton.setPosition(0, 20);
        newGameButton.addChild(newGameLabel);
        newGameButton.setLocalZOrder(2);

        var titleButton = new cc.MenuItemSprite(buttonSpriteOn2, buttonSpriteOff2, null, this.callback, this);
        titleButton.tag = 4;
        titleButton.setPosition(0,-100);
        titleButton.addChild(titleLabel);
        titleButton.setLocalZOrder(2);


        var menu = this._menu = new cc.Menu();
        menu.setPosition(cc.winSize.width / 2, cc.winSize.height / 2);
        menu.addChild(backgroundButton);
        menu.addChild(backPanel);
        menu.addChild(newGameButton);
        menu.addChild(titleButton);
        this.addChild(menu,0);
    },

    callback: function (button) {
        var tag = button.tag;

        switch (tag) {
            case 1:
                break;

            case 2:
                break;

            case 3:
                this.onTapNewGameButton();
                break;
            case 4:
                this.onTapTitleButton();
                break;

            default:
                break;
        }
    },

    onTapNewGameButton: function(button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapNewGameButton)) {
            this._delegate.onTapNewGameButton(this);
        }
    },

    onTapTitleButton: function(button) {
        if (this._delegate && cc.isFunction(this._delegate.onTapExitButton)) {
            this._delegate.onTapExitButton(this);
        }
    }
});

var ActiveCell = cc.Node.extend({
    _value : 0,
    _cellLabel : null,
    _cell : null,
    _id : -1,
    ctor: function (value, tileSize, id) {
        this._super();
        this._tileSize = tileSize;
        this._cellLabel = new cc.LabelTTF("",FONT, 36);
        this._cell = new cc.Scale9Sprite(res.block_png, cc.rect(0, 0, 40, 40), cc.rect(15, 15, 10, 10));
        this._cell.setContentSize(this._tileSize, this._tileSize);
        this._cellLabel.setPosition(this._tileSize / 2, this._tileSize / 2);
        this._cell.addChild(this._cellLabel);
        this._id = id;
        this.addChild(this._cell);
        this.setValue(value);
    },

    setValue: function (value) {
        this._value = value;
        this._cellLabel.setString(""+Math.pow(2,this._value));

        switch (this._value) {
            case 1: this._cell.setColor(cc.color(0xE5, 0xFF, 0xFC, 255));
                this._cellLabel.setFontFillColor(cc.color(0xAE, 0xCC, 0xC8, 255));
                break;

            case 2: this._cell.setColor(cc.color(0xAD, 0xF2, 0xF0, 255));
                this._cellLabel.setFontFillColor(cc.color(0xAE, 0xCC, 0xC8, 255));
                break;

            case 3: this._cell.setColor(cc.color(0x92, 0xCB, 0xE7, 255));
                this._cellLabel.setFontFillColor(cc.color(255, 255, 255, 255));
                break;

            case 4: this._cell.setColor(cc.color(0x4D, 0x74, 0xFF, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                break;

            case 5: this._cell.setColor(cc.color(0x83, 0x60, 0xF4, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                break;

            case 6: this._cell.setColor(cc.color(0x73, 0x2E, 0xFB, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                break;

            case 7: this._cell.setColor(cc.color(0x76, 0xF5, 0xFF, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                break;

            case 8: this._cell.setColor(cc.color(0x00, 0xEC, 0xFF, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                break;

            case 9: this._cell.setColor(cc.color(0x00, 0x05, 0xFF, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                break;

            case 10: this._cell.setColor(cc.color(0x05, 0x00, 0x94, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                this._cellLabel.setFontSize(28);
                break;

            case 11: this._cell.setColor(cc.color(0x1F, 0x05, 0x60, 255));
                this._cellLabel.setFontFillColor((cc.color(255, 255, 255, 255)));
                this._cellLabel.setFontSize(28);
                break;
        }
    },

    getValue: function () {
        return this._value;
    },

    getID: function () {
        return this._id;
    }
});
