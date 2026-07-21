//
//  NextGenEngineBridge.mm
//  ZionStageApple
//
//  Implementación Objective-C++ que utiliza AVAudioEngine y AVFoundation nativo de Apple
//  para mezcla multitrack de ultra baja latencia en iOS, iPadOS y macOS.
//

#import "NextGenEngineBridge.h"
#import <AVFoundation/AVFoundation.h>

@interface TrackNode : NSObject
@property (nonatomic, strong) NSString *trackId;
@property (nonatomic, strong) NSString *path;
@property (nonatomic, strong) AVAudioPlayerNode *playerNode;
@property (nonatomic, strong) AVAudioFile *audioFile;
@property (nonatomic, assign) float volume;
@property (nonatomic, assign) float pan;
@property (nonatomic, assign) BOOL isMuted;
@property (nonatomic, assign) BOOL isSolo;
@end

@implementation TrackNode
@end

@implementation NextGenEngineBridge {
    AVAudioEngine *_audioEngine;
    AVAudioUnitTimePitch *_timePitchUnit;
    AVAudioMixerNode *_masterMixer;
    NSMutableArray<TrackNode *> *_tracks;
    BOOL _isPlaying;
    double _currentTime;
    float _masterVolume;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _tracks = [NSMutableArray array];
        _isPlaying = NO;
        _currentTime = 0.0;
        _masterVolume = 1.0f;
        
        _audioEngine = [[AVAudioEngine alloc] init];
        _masterMixer = _audioEngine.mainMixerNode;
        
        _timePitchUnit = [[AVAudioUnitTimePitch alloc] init];
        [_audioEngine attachNode:_timePitchUnit];
        [_audioEngine connect:_timePitchUnit to:_masterMixer format:nil];
    }
    return self;
}

- (void)loadSongWithStemsJson:(NSString *)stemsJson {
    [self stop];
    
    // Limpiar nodos anteriores
    for (TrackNode *node in _tracks) {
        [_audioEngine detachNode:node.playerNode];
    }
    [_tracks removeAllObjects];
    
    NSData *data = [stemsJson dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) return;
    
    NSError *error = nil;
    NSArray *array = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    if (error || ![array isKindOfClass:[NSArray class]]) return;
    
    AVAudioFormat *processingFormat = nil;
    
    for (NSDictionary *dict in array) {
        if (![dict isKindOfClass:[NSDictionary class]]) continue;
        
        NSString *trackId = [dict objectForKey:@"id"] ?: @"";
        NSString *path = [dict objectForKey:@"path"] ?: @"";
        float volume = [[dict objectForKey:@"volume"] floatValue];
        BOOL muted = [[dict objectForKey:@"muted"] boolValue];
        
        if (path.length == 0 || ![[NSFileManager defaultManager] fileExistsAtPath:path]) {
            continue;
        }
        
        NSURL *fileURL = [NSURL fileURLWithPath:path];
        AVAudioFile *audioFile = [[AVAudioFile alloc] initForReading:fileURL error:&error];
        if (error || !audioFile) continue;
        
        if (!processingFormat) {
            processingFormat = audioFile.processingFormat;
        }
        
        AVAudioPlayerNode *player = [[AVAudioPlayerNode alloc] init];
        [_audioEngine attachNode:player];
        [_audioEngine connect:player to:_timePitchUnit format:processingFormat];
        
        TrackNode *node = [[TrackNode alloc] init];
        node.trackId = trackId;
        node.path = path;
        node.playerNode = player;
        node.audioFile = audioFile;
        node.volume = volume;
        node.isMuted = muted;
        node.isSolo = NO;
        node.pan = 0.0f;
        
        player.volume = muted ? 0.0f : volume;
        player.pan = 0.0f;
        
        [_tracks addObject:node];
    }
    
    [_audioEngine prepare];
}

- (void)play {
    if (_tracks.count == 0) return;
    
    NSError *error = nil;
    if (!_audioEngine.isRunning) {
        [_audioEngine startAndReturnError:&error];
    }
    
    for (TrackNode *node in _tracks) {
        [node.playerNode stop];
        [node.playerNode scheduleFile:node.audioFile atTime:nil completionHandler:nil];
        [node.playerNode play];
    }
    _isPlaying = YES;
}

- (void)pause {
    for (TrackNode *node in _tracks) {
        [node.playerNode pause];
    }
    [_audioEngine pause];
    _isPlaying = NO;
}

- (void)stop {
    for (TrackNode *node in _tracks) {
        [node.playerNode stop];
    }
    [_audioEngine stop];
    _isPlaying = NO;
    _currentTime = 0.0;
}

- (void)seekToSeconds:(double)seconds {
    _currentTime = seconds;
    if (_isPlaying) {
        [self play];
    }
}

- (void)updateSoloMuteVolumes {
    BOOL anySolo = NO;
    for (TrackNode *node in _tracks) {
        if (node.isSolo) {
            anySolo = YES;
            break;
        }
    }
    
    for (TrackNode *node in _tracks) {
        if (anySolo) {
            node.playerNode.volume = (node.isSolo && !node.isMuted) ? node.volume : 0.0f;
        } else {
            node.playerNode.volume = node.isMuted ? 0.0f : node.volume;
        }
    }
}

- (void)setTrackVolumeWithId:(NSString *)trackId volume:(float)volume {
    for (TrackNode *node in _tracks) {
        if ([node.trackId isEqualToString:trackId]) {
            node.volume = volume;
            [self updateSoloMuteVolumes];
            break;
        }
    }
}

- (void)setTrackMuteWithId:(NSString *)trackId muted:(BOOL)muted {
    for (TrackNode *node in _tracks) {
        if ([node.trackId isEqualToString:trackId]) {
            node.isMuted = muted;
            [self updateSoloMuteVolumes];
            break;
        }
    }
}

- (void)setTrackSoloWithId:(NSString *)trackId solo:(BOOL)solo {
    for (TrackNode *node in _tracks) {
        if ([node.trackId isEqualToString:trackId]) {
            node.isSolo = solo;
            [self updateSoloMuteVolumes];
            break;
        }
    }
}

- (void)setTrackPanWithId:(NSString *)trackId pan:(float)pan {
    for (TrackNode *node in _tracks) {
        if ([node.trackId isEqualToString:trackId]) {
            node.pan = pan;
            node.playerNode.pan = pan;
            break;
        }
    }
}

- (void)setPitchSemiTones:(float)semitones {
    // Convertir semitonos a cents (-300 a +300)
    _timePitchUnit.pitch = semitones * 100.0f;
}

- (void)setTempoRatio:(float)ratio {
    _timePitchUnit.rate = ratio;
}

- (void)setMasterVolume:(float)volume {
    _masterVolume = volume;
    _masterMixer.outputVolume = volume;
}

- (NSString *)getSnapshotJson {
    return @"{\"status\":\"ok\"}";
}

@end
