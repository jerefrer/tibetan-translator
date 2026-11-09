// Makes the web view behave like the rest of an iOS app.
//
// - No form accessory bar (the "^ v ✓" strip WebKit puts above the keyboard):
//   native apps never show it, and the app has a single field per screen.
// - No scroll edge effect under the status bar (iOS 26): it drew a grey band
//   over the app's own background at the top of every screen.
//
// Both are done once at launch from +load, by replacing methods of WebKit's
// classes, since Tauri creates the WKWebView itself.

#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

static id noInputAccessoryView(id self, SEL _cmd) {
  return nil;
}

static IMP originalDidMoveToWindow = NULL;

static void hideEdgeEffects(WKWebView *webView) {
  UIScrollView *scrollView = webView.scrollView;
  // topEdgeEffect exists from iOS 26; earlier systems have no edge effect
  if ([scrollView respondsToSelector:NSSelectorFromString(@"topEdgeEffect")]) {
    id topEdgeEffect = [scrollView valueForKey:@"topEdgeEffect"];
    [topEdgeEffect setValue:@YES forKey:@"hidden"];
  }
}

static void didMoveToWindow(WKWebView *self, SEL _cmd) {
  ((void (*)(id, SEL))originalDidMoveToWindow)(self, _cmd);
  hideEdgeEffects(self);
}

// Replaces `selector` on `cls` only. When `cls` merely inherits it, the method
// is added to `cls` instead, so the superclass (UIView, UIResponder) and every
// other subclass keep their own. Returns the implementation that was in effect.
static IMP replaceMethod(Class cls, SEL selector, IMP replacement) {
  Method method = class_getInstanceMethod(cls, selector);
  if (!method) return NULL;
  IMP previous = method_getImplementation(method);
  if (class_addMethod(cls, selector, replacement, method_getTypeEncoding(method))) {
    return previous;
  }
  return method_setImplementation(method, replacement);
}

@interface TTWebViewTweaks : NSObject
@end

@implementation TTWebViewTweaks

+ (void)load {
  // WKContentView is the private view that owns the keyboard while a field is
  // focused; it is the one asked for an input accessory view
  Class contentView = NSClassFromString(@"WKContentView");
  if (contentView) {
    replaceMethod(contentView, @selector(inputAccessoryView), (IMP)noInputAccessoryView);
  }

  originalDidMoveToWindow =
      replaceMethod([WKWebView class], @selector(didMoveToWindow), (IMP)didMoveToWindow);
}

@end
