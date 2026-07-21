//
//  NextGenEngineBridge.mm
//  ZionStageApple
//
//  Implementación Objective-C++ que instancia NextGenMultitrackEngine nativo.
//

#import "NextGenEngineBridge.h"

// Enlaza directo al motor C++ multiplataforma del repositorio
#include "../../../android/app/src/main/cpp/NextGenMultitrackEngine.h"

@implementation NextGenEngineBridge {
    std::unique_ptr<nextgen::NextGenMultitrackEngine> _engine;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _engine = std::make_unique<nextgen::NextGenMultitrackEngine>();
    }
    return self;
}

- (void)loadSongWithStemsJson:(NSString *)stemsJson {
    if (!_engine) return;
    // Convierte el JSON recibido de Swift a estructura C++ StemDesc
    NSData *data = [stemsJson dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) return;
    
    NSError *error = nil;
    NSArray *array = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    if (error || ![array isKindOfClass:[NSArray class]]) return;
    
    std::vector<nextgen::StemDesc> stems;
    for (NSDictionary *dict in array) {
        if (![dict isKindOfClass:[NSDictionary class]]) continue;
        nextgen::StemDesc desc;
        desc.id = [[dict objectForKey:@"id"] UTF8String] ?: "";
        desc.path = [[dict objectForKey:@"path"] UTF8String] ?: "";
        desc.volume = [[dict objectForKey:@"volume"] floatValue];
        desc.muted = [[dict objectForKey:@"muted"] boolValue];
        stems.push_back(desc);
    }
    
    _engine->loadSongSession(stems);
}

- (void)play {
    if (_engine) _engine->play();
}

- (void)pause {
    if (_engine) _engine->pause();
}

- (void)stop {
    if (_engine) _engine->stop();
}

- (void)seekToSeconds:(double)seconds {
    if (_engine) _engine->seekSeconds(seconds);
}

- (void)setTrackVolumeWithId:(NSString *)trackId volume:(float)volume {
    if (_engine) _engine->setTrackVolume([trackId UTF8String], volume);
}

- (void)setTrackMuteWithId:(NSString *)trackId muted:(BOOL)muted {
    if (_engine) _engine->setTrackMute([trackId UTF8String], muted);
}

- (void)setTrackSoloWithId:(NSString *)trackId solo:(BOOL)solo {
    if (_engine) _engine->setTrackSolo([trackId UTF8String], solo);
}

- (void)setTrackPanWithId:(NSString *)trackId pan:(float)pan {
    if (_engine) _engine->setTrackPan([trackId UTF8String], pan);
}

- (void)setPitchSemiTones:(float)semitones {
    if (_engine) _engine->setPitchSemiTones(semitones);
}

- (void)setTempoRatio:(float)ratio {
    if (_engine) _engine->setTempoRatio(ratio);
}

- (void)setMasterVolume:(float)volume {
    if (_engine) _engine->setMasterVolume(volume);
}

- (NSString *)getSnapshotJson {
    if (!_engine) return @"{}";
    std::string jsonStr = _engine->getSnapshotJson();
    return [NSString stringWithUTF8String:jsonStr.c_str()];
}

@end
