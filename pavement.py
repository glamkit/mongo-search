# -*- Import: -*-
from paver.easy import *
from paver import setuputils
#from distutils.core import setup
from setuptools import find_packages
from paver.setuputils import setup

PROJECT = 'mongofulltextsearch'

try:
    # Optional tasks, only needed for development
    # -*- Optional import: -*-
    from github.tools.task import *
    import paver.doctools
    import paver.virtual
    import paver.misctasks
    ALL_TASKS_LOADED = True
except ImportError, e:
    info("some tasks could not not be imported.")
    debug(str(e))
    ALL_TASKS_LOADED = False

setuputils.standard_exclude+=('.gitignore',)
setuputils.standard_exclude_directories+=('.git',)


PACKAGE_DATA = setuputils.find_package_data(PROJECT, 
                                            package=PROJECT,
                                            only_in_packages=False,)

version = '0.1-alpha'

classifiers = [
    # Get more strings from http://www.python.org/pypi?%3Aaction=list_classifiers
    "Development Status :: 3 - Alpha",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: BSD License",
    "Operating System :: MacOS :: MacOS X",
    "Operating System :: POSIX",
    "Programming Language :: Python",
    "Programming Language :: JavaScript",
    "Topic :: Database",
    "Topic :: Text Processing :: Indexing"
    "Natural Language :: English",
    ]

install_requires = [
    # -*- Install requires: -*-
    'setuptools',
    'pymongo >= 1.6'
    ]

entry_points="""
    # -*- Entry points: -*-
    """

# compatible with distutils of python 2.3+ or later
setup(
    name=PROJECT,
    version=version,
    description='Full text search for mongo in javascript, with python client driver',
    long_description=open('README.rst', 'r').read(),
    classifiers=classifiers,
    keywords='fulltextsearch search mongodb javascript',
    author='Andy and Dan MacKinlay',
    author_email='fillmewithspam@email.possumpalace.org',
    url='http://github.com/howthebodyworks/mongo-full-text-search/',
    license='BSD',
    packages = find_packages(exclude=['bootstrap', 'pavement',]),
    package_dir = {'mongofulltextsearch': 'mongofulltextsearch'},
    include_package_data=True,
    package_data=PACKAGE_DATA,
    test_suite='nose.collector',
    zip_safe=False,
    install_requires=install_requires,
    entry_points=entry_points,
)

options(
    # -*- Paver options: -*-
    minilib=Bunch(
        extra_files=[
            # -*- Minilib extra files: -*-
            ]
        ),
    sphinx=Bunch(
        docroot='docs',
        builddir="_build",
        sourcedir=""
        ),
    virtualenv=Bunch(
        packages_to_install=[
            # -*- Virtualenv packages to install: -*-
            'github-tools',
            "nose",
            "Sphinx>=0.6b1",
            "pkginfo", 
            "virtualenv"],
        dest_dir='./virtual-env/',
        install_paver=True,
        script_name='bootstrap.py',
        paver_command_line=None
        ),
    )


if ALL_TASKS_LOADED:
    @task
    @needs('generate_setup', 'minilib', 'setuptools.command.sdist')
    def sdist():
        """Overrides sdist to make sure that our setup.py is generated."""
# 
# options(
#     setup=Bunch(
#         name = PROJECT,
#         version = VERSION,
# 
#         description = 'Python Module of the Week Examples: ' + MODULE,
#         long_description = README,
# 
#         author = 'Doug Hellmann',
#         author_email = 'doug.hellmann@gmail.com',
# 
#         url = 'http://www.doughellmann.com/PyMOTW/',
#         download_url = 'http://www.doughellmann.com/downloads/%s-%s.tar.gz' % \
#                         (PROJECT, VERSION),
# 
#         classifiers = [ 'Development Status :: 5 - Production/Stable',
#                         'Environment :: Console',
#                         'Intended Audience :: Developers',
#                         'Intended Audience :: Education',
#                         'License :: OSI Approved :: BSD License',
#                         'Operating System :: POSIX',
#                         'Programming Language :: Python',
#                         'Topic :: Software Development',
#                         ],
# 
#         platforms = ('Any',),
#         keywords = ('python', 'PyMOTW', 'documentation'),
# 
#         # It seems wrong to have to list recursive packages explicitly.
#         packages = sorted(PACKAGE_DATA.keys()),
#         package_data=PACKAGE_DATA,
#         zip_safe=False,
# 
#         scripts=['motw'],
# 
#         ),

