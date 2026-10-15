#!/usr/bin/env python3
"""Generate the checked-in Xcode project without requiring macOS or XcodeGen."""
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

root = Path(__file__).resolve().parents[1]
objects = {}
def ident(key): return hashlib.sha256(key.encode()).hexdigest()[:24].upper()
def add(key, isa, **values):
    value = ident(key)
    objects[value] = dict(isa=isa, **values)
    return value

def source_files(folder):
    result = []
    for path in sorted((root / folder).rglob('*.swift')):
        rel = path.relative_to(root).as_posix()
        ref = add(rel, 'PBXFileReference', lastKnownFileType='sourcecode.swift', path=rel, sourceTree='<group>')
        build = add('build:' + rel, 'PBXBuildFile', fileRef=ref)
        result.append((ref, build))
    return result

app = source_files('Nadorio')
tests = source_files('NadorioTests')
resources = []
for rel in ['Nadorio/Resources/Configuration.plist', 'Nadorio/Resources/PrivacyInfo.xcprivacy']:
    ref = add(rel, 'PBXFileReference', lastKnownFileType='text.plist.xml', path=rel, sourceTree='<group>')
    build = add('build:' + rel, 'PBXBuildFile', fileRef=ref)
    resources.append((ref, build))
info = add('Info.plist', 'PBXFileReference', lastKnownFileType='text.plist.xml', path='Info.plist', sourceTree='<group>')
app_product = add('app-product', 'PBXFileReference', explicitFileType='wrapper.application', path='Nadorio.app', sourceTree='BUILT_PRODUCTS_DIR')
test_product = add('test-product', 'PBXFileReference', explicitFileType='wrapper.cfbundle', path='NadorioTests.xctest', sourceTree='BUILT_PRODUCTS_DIR')
products = add('products', 'PBXGroup', children=[app_product, test_product], name='Products', sourceTree='<group>')
main_group = add('main-group', 'PBXGroup', children=[r for r,b in app + tests + resources] + [info, products], sourceTree='<group>')

def phase(key, isa, files):
    return add(key, isa, buildActionMask=2147483647, files=files, runOnlyForDeploymentPostprocessing=0)
app_phases = [phase('app-sources','PBXSourcesBuildPhase',[b for r,b in app]), phase('app-frameworks','PBXFrameworksBuildPhase',[]), phase('app-resources','PBXResourcesBuildPhase',[b for r,b in resources])]
test_phases = [phase('test-sources','PBXSourcesBuildPhase',[b for r,b in tests]), phase('test-frameworks','PBXFrameworksBuildPhase',[]), phase('test-resources','PBXResourcesBuildPhase',[])]

def configs(key, base):
    refs = []
    for mode in ['Debug','Release']:
        settings = dict(base)
        settings.update(SWIFT_OPTIMIZATION_LEVEL='-Onone' if mode == 'Debug' else '-O', DEBUG_INFORMATION_FORMAT='dwarf' if mode == 'Debug' else 'dwarf-with-dsym')
        if mode == 'Debug': settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = 'DEBUG $(inherited)'
        refs.append(add(key+mode,'XCBuildConfiguration',buildSettings=settings,name=mode))
    return add(key+'list','XCConfigurationList',buildConfigurations=refs,defaultConfigurationIsVisible=0,defaultConfigurationName='Release')

common = dict(SWIFT_VERSION='5.0', IPHONEOS_DEPLOYMENT_TARGET='17.0', SDKROOT='iphoneos', TARGETED_DEVICE_FAMILY='1,2', CODE_SIGN_STYLE='Automatic', MARKETING_VERSION='1.0.0', CURRENT_PROJECT_VERSION='1', CLANG_ENABLE_MODULES='YES', CLANG_ENABLE_OBJC_ARC='YES', ENABLE_TESTABILITY='YES', SUPPORTED_PLATFORMS='iphoneos iphonesimulator')
app_settings = dict(common, PRODUCT_BUNDLE_IDENTIFIER='com.cd7technologies.nadorio', PRODUCT_NAME='$(TARGET_NAME)', INFOPLIST_FILE='Info.plist', GENERATE_INFOPLIST_FILE='NO', LD_RUNPATH_SEARCH_PATHS=['$(inherited)','@executable_path/Frameworks'])
test_settings = dict(common, PRODUCT_BUNDLE_IDENTIFIER='com.cd7technologies.nadorio.tests', PRODUCT_NAME='$(TARGET_NAME)', GENERATE_INFOPLIST_FILE='YES', BUNDLE_LOADER='$(TEST_HOST)', TEST_HOST='$(BUILT_PRODUCTS_DIR)/Nadorio.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Nadorio', LD_RUNPATH_SEARCH_PATHS=['$(inherited)','@executable_path/Frameworks','@loader_path/Frameworks'])
app_target = add('app-target','PBXNativeTarget',buildConfigurationList=configs('app-config',app_settings),buildPhases=app_phases,buildRules=[],dependencies=[],name='Nadorio',productName='Nadorio',productReference=app_product,productType='com.apple.product-type.application')
proxy = add('test-proxy','PBXContainerItemProxy',containerPortal=ident('project'),proxyType=1,remoteGlobalIDString=app_target,remoteInfo='Nadorio')
dependency = add('test-dependency','PBXTargetDependency',target=app_target,targetProxy=proxy)
test_target = add('test-target','PBXNativeTarget',buildConfigurationList=configs('test-config',test_settings),buildPhases=test_phases,buildRules=[],dependencies=[dependency],name='NadorioTests',productName='NadorioTests',productReference=test_product,productType='com.apple.product-type.bundle.unit-test')
project = add('project','PBXProject',attributes={'LastUpgradeCheck':'1600','TargetAttributes':{app_target:{'CreatedOnToolsVersion':'16.0'},test_target:{'CreatedOnToolsVersion':'16.0','TestTargetID':app_target}}},buildConfigurationList=configs('project-config',{'ALWAYS_SEARCH_USER_PATHS':'NO'}),compatibilityVersion='Xcode 14.0',developmentRegion='en',hasScannedForEncodings=0,knownRegions=['en','Base'],mainGroup=main_group,productRefGroup=products,projectDirPath='',projectRoot='',targets=[app_target,test_target])

def render(value, depth=0):
    pad = '\t' * depth
    if isinstance(value, dict):
        return '{\n' + ''.join('\t'*(depth+1)+json.dumps(k)+' = '+render(v,depth+1)+';\n' for k,v in value.items()) + pad + '}'
    if isinstance(value, list): return '(\n' + ''.join('\t'*(depth+1)+render(v,depth+1)+',\n' for v in value) + pad + ')'
    if isinstance(value, int): return str(value)
    return json.dumps(value)

project_dir = root / 'Nadorio.xcodeproj'
project_dir.mkdir(exist_ok=True)
(project_dir/'project.pbxproj').write_text('// !$*UTF8*$!\n'+render({'archiveVersion':1,'classes':{},'objectVersion':56,'objects':objects,'rootObject':project})+'\n')
schemes = project_dir/'xcshareddata/xcschemes'
schemes.mkdir(parents=True,exist_ok=True)
def ref(target,name,product):
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="{product}" BlueprintName="{name}" ReferencedContainer="container:Nadorio.xcodeproj"/>'
a = ref(app_target,'Nadorio','Nadorio.app')
t = ref(test_target,'NadorioTests','NadorioTests.xctest')
(schemes/'Nadorio.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{a}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{t}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{a}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{a}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
workspace = project_dir/'project.xcworkspace'
workspace.mkdir(exist_ok=True)
(workspace/'contents.xcworkspacedata').write_text('<?xml version="1.0" encoding="UTF-8"?><Workspace version="1.0"><FileRef location="self:"/></Workspace>\n')
print('Generated', project_dir)
