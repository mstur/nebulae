import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Collections;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import javax.tools.JavaCompiler;
import javax.tools.StandardJavaFileManager;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;

public class JavaJudge {
	public static void main(String[] args) {
		if (args.length != 3) {
			System.out.println("Internal error");
			System.exit(-1);
		}

		String filePath = args[0];
		String className = args[1];
		int runTime = Integer.parseInt(args[2]);

		File codeFile = null;
		codeFile = new File(filePath + "/" + className + ".java");

		JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
		StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null);

		File classFile = new File(filePath + "/");
		try {
			classFile.createNewFile();
			fileManager.setLocation(StandardLocation.CLASS_OUTPUT, Collections.singleton(classFile));
		} catch (IOException e) {
			System.out.println("Internal error");
			System.exit(-1);
		}

		JavaCompiler.CompilationTask task = compiler.getTask(null, fileManager, null, null, null,
				fileManager.getJavaFileObjects(codeFile));
		if (!task.call()) {
			System.out.println("Compilation error");
			System.exit(1);
		}

		URL[] classpaths = new URL[1];
		try {
			classpaths[0] = new URL("file:///" + filePath + "/");
		} catch (MalformedURLException e) {
			System.out.println("Internal error");
			System.exit(-1);
		}
		URLClassLoader loader = new URLClassLoader(classpaths);

		try {
			Class<?> c = loader.loadClass(className);
			final Method main = c.getMethod("main", String[].class);
			final Thread th = new Thread(new Runnable() {
				@Override
				public void run() {
					try {
						String[] arguments = new String[0];
						Object[] invokedArgs = { arguments };
						main.invoke(c, invokedArgs);
					} catch (Throwable thr) {
						System.out.println("Runtime Error");
						System.exit(2);
					}
				}
			});
			th.setContextClassLoader(loader);
			ExecutorService es = Executors.newSingleThreadExecutor();
			Future<?> future = es.submit(th);
			try {
				future.get(runTime, TimeUnit.SECONDS);
			} catch (TimeoutException e) {
				future.cancel(true);
				System.out.println("Timeout");
				System.exit(3);
			}
			es.shutdownNow();
		} catch (ClassNotFoundException e) {
			System.out.println("Internal error");
			System.exit(-1);
		} catch (NoSuchMethodException e) {
			System.out.println("Internal error");
			System.exit(-1);
		} catch (SecurityException e) {
			System.out.println("Internal error");
			System.exit(-1);
		} catch (InterruptedException e) {
			System.out.println("Internal error");
			System.exit(-1);
		} catch (ExecutionException e) {
			System.out.println("Internal error");
			System.exit(-1);
		}

	}
}
